#!/usr/bin/env bash
#
# Starts everything: Postgres, the API, and the web app.
#
#   scripts/dev.sh            start it all
#   scripts/dev.sh --reset    wipe the database back to schema + seed first
#   scripts/dev.sh --no-db    assume Postgres is already running elsewhere
#
# Ctrl-C stops the API and web servers. Postgres is left running so the next
# start is instant — stop it with `npm run db:down` in apps/api.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="$ROOT/apps/api"
WEB="$ROOT/apps/web"
COMPOSE="$ROOT/db/compose.yaml"

# Overridable for the odd case where something else owns the default port:
#   WEB_PORT=5199 scripts/dev.sh
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-5173}"

RESET=0
START_DB=1
for arg in "$@"; do
  case "$arg" in
    --reset) RESET=1 ;;
    --no-db) START_DB=0 ;;
    -h | --help)
      # Print the comment block at the top, minus the shebang.
      awk 'NR > 1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

# ── output ───────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  DIM='\033[2m'; BOLD='\033[1m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; OFF='\033[0m'
else
  DIM=''; BOLD=''; GREEN=''; YELLOW=''; RED=''; OFF=''
fi

step() { printf "${BOLD}▸ %s${OFF}\n" "$1"; }
info() { printf "${DIM}  %s${OFF}\n" "$1"; }
warn() { printf "${YELLOW}  ! %s${OFF}\n" "$1"; }
die() {
  printf "${RED}✗ %s${OFF}\n" "$1" >&2
  exit 1
}

# ── shutdown ─────────────────────────────────────────────────────────────────
pids=()

# npm spawns sh, which spawns tsx/vite. Signalling npm alone strands the
# grandchildren holding the ports, so walk the tree and kill depth-first.
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill -TERM "$pid" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  # Keep a handle on the real stdout, then send everything else to /dev/null:
  # bash narrates each dying background job, which is noise at shutdown.
  exec 3>&1
  exec 1>/dev/null 2>/dev/null
  # Drop the jobs from the table first, or bash echoes each one as it dies.
  disown -a 2>/dev/null || true

  printf "\n${BOLD}▸ Stopping dev servers${OFF}\n" >&3
  for pid in "${pids[@]:-}"; do
    [ -n "$pid" ] || continue
    kill_tree "$pid"
  done

  # Don't hang here if something refuses to die; give it a moment, then go.
  for _ in $(seq 1 20); do
    still_running=0
    for pid in "${pids[@]:-}"; do
      [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && still_running=1
    done
    [ "$still_running" -eq 0 ] && break
    sleep 0.25
  done

  if [ "$START_DB" -eq 1 ]; then
    printf "${DIM}  Postgres is still up — 'npm run db:down' in apps/api stops it.${OFF}\n" >&3
  fi
  exit 0
}
# Ctrl-C reaches the children directly (same foreground group), so the
# supervisor below can notice them dying before this trap runs. The flag keeps
# a deliberate stop from being reported as a crash.
SHUTTING_DOWN=0
on_signal() {
  SHUTTING_DOWN=1
  cleanup
}
trap on_signal INT TERM
trap cleanup EXIT

# ── checks ───────────────────────────────────────────────────────────────────
command -v node >/dev/null || die "node is not installed"
command -v npm >/dev/null || die "npm is not installed"

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3<&- && return 0 || return 1; }

for port in "$API_PORT" "$WEB_PORT"; do
  if port_busy "$port"; then
    die "Port $port is already in use. Stop whatever is on it, or you'll get two of everything."
  fi
done

# ── dependencies ─────────────────────────────────────────────────────────────
for dir in "$API" "$WEB"; do
  if [ ! -d "$dir/node_modules" ]; then
    step "Installing dependencies in ${dir#"$ROOT"/}"
    (cd "$dir" && npm install --silent)
  fi
done

# ── api environment ──────────────────────────────────────────────────────────
if [ ! -f "$API/.env" ]; then
  step "Creating apps/api/.env"
  secret="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")"
  cat > "$API/.env" <<EOF
PORT=$API_PORT
DATABASE_URL=postgres://reckon:reckon@localhost:5432/reckon
SESSION_SECRET=$secret
WEB_ORIGIN=http://localhost:$WEB_PORT
EOF
  info "Generated a fresh SESSION_SECRET."
fi

# ── database ─────────────────────────────────────────────────────────────────
psql_db() { docker compose -f "$COMPOSE" exec -T db psql -U reckon -d reckon "$@"; }

if [ "$START_DB" -eq 1 ]; then
  command -v docker >/dev/null || die "docker is not installed (or use --no-db)"
  docker info >/dev/null 2>&1 || die "the docker daemon isn't running"

  step "Starting Postgres"
  docker compose -f "$COMPOSE" up -d --wait >/dev/null
  info "postgres://reckon:reckon@localhost:5432/reckon"

  # First run, or --reset: lay down schema and fixtures.
  has_tables="$(psql_db -tAc "select to_regclass('public.users') is not null" 2>/dev/null || echo f)"
  if [ "$RESET" -eq 1 ] || [ "$has_tables" != "t" ]; then
    step "Applying schema + seed"
    psql_db -v ON_ERROR_STOP=1 -q -f /db/schema.sql -f /db/seed.sql >/dev/null
    info "Sign in with dev@reckon.local / reckon-dev-password"
  fi
fi

# ── servers ──────────────────────────────────────────────────────────────────
run() {
  local label="$1" color="$2" dir="$3"
  shift 3
  (
    cd "$dir"
    "$@" 2>&1 | while IFS= read -r line; do
      printf "${color}%-4s${OFF} %s\n" "$label" "$line"
    done
  ) &
  pids+=($!)
  # Off the job table, so bash doesn't narrate their deaths on shutdown.
  disown "$!" 2>/dev/null || true
}

step "Starting API and web"
# PORT/WEB_ORIGIN are exported so the overrides above beat apps/api/.env —
# dotenv leaves an already-set variable alone.
run "api" "$GREEN" "$API" \
  env PORT="$API_PORT" WEB_ORIGIN="http://localhost:$WEB_PORT" npm run dev
run "web" "$YELLOW" "$WEB" npm run dev -- --port "$WEB_PORT" --strictPort

# Wait for the API to answer before pointing anyone at the browser.
for _ in $(seq 1 40); do
  if curl -fsS "http://localhost:$API_PORT/health" >/dev/null 2>&1; then
    printf "\n${BOLD}${GREEN}✓ Reckon is up${OFF}\n"
    printf "  web  http://localhost:%s\n" "$WEB_PORT"
    printf "  api  http://localhost:%s\n" "$API_PORT"
    printf "${DIM}  Ctrl-C to stop.${OFF}\n\n"
    break
  fi
  sleep 0.5
done

# Supervise: if either server falls over, take the whole stack down rather than
# leaving half of it running and looking healthy.
while :; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      # True whether you pressed Ctrl-C or a server fell over on its own; if it
      # crashed, its error output is a few lines above this.
      sleep 0.4
      [ "$SHUTTING_DOWN" -eq 1 ] && exit 0
      printf "\n${DIM}  One server stopped — shutting down the rest.${OFF}\n"
      cleanup
    fi
  done
  sleep 1
done
