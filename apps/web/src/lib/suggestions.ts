import { hoursBetween } from './format';
import type { Client, Session } from './types';

/*
 * What the app can work out about a user's habits from the hours they have
 * already logged.
 *
 * All of it is derived on the spot from data the screen already has: nothing
 * here is stored, so there is no preference to keep in sync and no setting to
 * get wrong. A freelancer who changes their shift simply starts being offered
 * the new one.
 */

export interface ShiftSuggestion {
  clientId: string;
  clientName: string;
  start: string;
  end: string;
}

/**
 * The shifts worth offering as a single tap.
 *
 * One per client — the times that client is worked most often, most recent
 * wins a tie — ordered by who was worked for last. Three is the limit because
 * a fourth chip is no longer a shortcut, it's a list to read.
 */
export function shiftSuggestions(
  sessions: Session[],
  clients: Client[],
  limit = 3,
): ShiftSuggestion[] {
  const byClient = new Map<
    string,
    { counts: Map<string, number>; lastSeen: string; lastShift: string }
  >();

  // Newest first, so the first sighting of a client is also its most recent.
  const ordered = [...sessions].sort((a, b) =>
    (b.date + b.start).localeCompare(a.date + a.start),
  );

  for (const s of ordered) {
    if (!s.clientId) continue;
    const shift = `${s.start}–${s.end}`;
    const entry = byClient.get(s.clientId);
    if (!entry) {
      byClient.set(s.clientId, {
        counts: new Map([[shift, 1]]),
        lastSeen: s.date + s.start,
        lastShift: shift,
      });
      continue;
    }
    entry.counts.set(shift, (entry.counts.get(shift) ?? 0) + 1);
  }

  const suggestions: (ShiftSuggestion & { lastSeen: string })[] = [];
  for (const [clientId, entry] of byClient) {
    const client = clients.find((c) => c.id === clientId);
    if (!client || !client.isActive) continue;

    let best = entry.lastShift;
    let bestCount = entry.counts.get(entry.lastShift) ?? 0;
    for (const [shift, count] of entry.counts) {
      if (count > bestCount) {
        best = shift;
        bestCount = count;
      }
    }

    const [start, end] = best.split('–') as [string, string];
    suggestions.push({
      clientId,
      clientName: client.name,
      start,
      end,
      lastSeen: entry.lastSeen,
    });
  }

  return suggestions
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, limit)
    .map(({ clientId, clientName, start, end }) => ({
      clientId,
      clientName,
      start,
      end,
    }));
}

/** Whether this exact stretch of work is already on the books for that day. */
export function alreadyLogged(
  sessions: Session[],
  entry: { clientId: string; date: string; start: string; end: string },
): boolean {
  return sessions.some(
    (s) =>
      s.clientId === entry.clientId &&
      s.date === entry.date &&
      s.start === entry.start &&
      s.end === entry.end,
  );
}

/**
 * The client worked most recently — what a new entry should open on.
 *
 * Alphabetical order is arbitrary; what someone logged last time is not. Only
 * clients still on the books are offered, so a deactivated one doesn't reappear
 * through the back door, and an empty ledger falls back to the first active
 * client as before.
 */
export function lastClientId(sessions: Session[], clients: Client[]): string {
  const usable = new Set(clients.filter((c) => c.isActive).map((c) => c.id));
  const latest = [...sessions]
    .filter((s) => usable.has(s.clientId))
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0];
  return latest?.clientId ?? '';
}

export interface Shift {
  start: string;
  end: string;
}

/** What a form falls back to when there is nothing at all to go on. */
export const DEFAULT_SHIFT: Shift = { start: '09:00', end: '17:00' };

/** The times a client was last worked, to open a form on instead of a guess. */
export function lastShiftFor(sessions: Session[], clientId: string): Shift | null {
  return newestShift(sessions.filter((s) => s.clientId === clientId));
}

/** The times last logged for anyone — the shape of this freelancer's day. */
export function lastShift(sessions: Session[]): Shift | null {
  return newestShift(sessions);
}

function newestShift(sessions: Session[]): Shift | null {
  const latest = [...sessions].sort((a, b) =>
    (b.date + b.start).localeCompare(a.date + a.start),
  )[0];
  return latest ? { start: latest.start, end: latest.end } : null;
}

/**
 * The times a new entry should open on.
 *
 * This client's own last shift first, since a client usually means a fixed
 * slot. Failing that — a new client, or a first entry — the times last logged
 * for anyone: someone who works mornings works mornings for the next client
 * too. 09:00–17:00 is only the answer on an empty ledger, where it is a guess
 * about a stranger rather than a claim about this person.
 */
export function usualShift(sessions: Session[], clientId: string): Shift {
  return lastShiftFor(sessions, clientId) ?? lastShift(sessions) ?? DEFAULT_SHIFT;
}

export interface UnbilledClient {
  clientId: string;
  name: string;
  hours: number;
  amount: number;
  /** Oldest unbilled date, which is what makes a total feel overdue. */
  since: string;
}

/**
 * Who is owed an invoice, and for how much.
 *
 * Deactivated clients are included: work already done still has to be billed,
 * and stopping work for someone is exactly when the last invoice is due.
 */
export function unbilledByClient(
  sessions: Session[],
  clients: Client[],
): UnbilledClient[] {
  const totals = new Map<string, { hours: number; since: string }>();

  for (const s of sessions) {
    if (s.invoiced || !s.clientId) continue;
    const current = totals.get(s.clientId);
    const hours = hoursBetween(s.start, s.end);
    if (!current) totals.set(s.clientId, { hours, since: s.date });
    else {
      current.hours += hours;
      if (s.date < current.since) current.since = s.date;
    }
  }

  const rows: UnbilledClient[] = [];
  for (const [clientId, { hours, since }] of totals) {
    const client = clients.find((c) => c.id === clientId);
    if (!client) continue;
    rows.push({
      clientId,
      name: client.name,
      hours,
      amount: hours * client.rate,
      since,
    });
  }

  return rows.sort((a, b) => b.amount - a.amount);
}
