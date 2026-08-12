/*
 * Utility recipes for patterns that repeat across the app — the same Tailwind
 * classes you'd write inline, named once so a button in a sheet and a button in
 * a view can't drift apart.
 */

export const card = 'bg-card border border-border rounded-2xl p-6 shadow-xs mb-4';

export const cardLabel =
  'font-mono text-2xs font-semibold uppercase tracking-wider text-muted-fg mb-3';

export const hint = 'text-xs text-muted-fg';

// ── buttons ──────────────────────────────────────────────────────────────────
const btnBase =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-transparent text-sm font-medium cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

export const btn = {
  primary: `${btnBase} bg-primary text-primary-fg hover:not-disabled:opacity-90`,
  secondary: `${btnBase} bg-secondary text-secondary-fg hover:not-disabled:opacity-90`,
  outline: `${btnBase} border-border text-fg hover:not-disabled:bg-muted`,
  ghost: `${btnBase} text-muted-fg hover:not-disabled:bg-muted hover:not-disabled:text-fg`,
  destructive: `${btnBase} bg-destructive text-destructive-fg hover:not-disabled:opacity-90`,
};

/** Size and width modifiers — append after a variant. */
export const btnSm = 'px-3 py-1 text-xs';
export const btnXs = 'px-2 py-0.5 text-2xs rounded-md';
export const btnBlock = 'w-full';

export const iconBtn =
  'w-9 h-9 rounded-lg border border-border text-fg inline-flex items-center justify-center cursor-pointer text-sm shrink-0 transition-all duration-150 hover:bg-muted';

// ── forms ────────────────────────────────────────────────────────────────────
export const input =
  'w-full px-3 py-2 border border-input-border rounded-lg text-sm bg-card text-fg outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15';

export const label = 'block text-sm font-medium mb-1.5';

export const field = 'mb-4';

export const row2 = 'grid grid-cols-2 gap-3';

// ── badges ───────────────────────────────────────────────────────────────────
const badgeBase =
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-2xs font-semibold capitalize';

export const badge = {
  success: `${badgeBase} bg-success-bg text-success-fg`,
  warning: `${badgeBase} bg-warning-bg text-warning-fg`,
  error: `${badgeBase} bg-error-bg text-error-fg`,
  info: `${badgeBase} bg-info-bg text-info-fg`,
  muted: `${badgeBase} bg-muted text-muted-fg`,
  primary: `${badgeBase} bg-primary text-primary-fg`,
};

// ── layout bits ──────────────────────────────────────────────────────────────
export const emptyState = 'text-center py-12 px-5 text-muted-fg';

export const emptyInline = 'text-muted-fg text-sm text-center py-5';

export const statCard = 'bg-card border border-border rounded-2xl p-5 shadow-xs';

export const statLabel = 'text-xs text-muted-fg font-medium mb-1';

export const statValue = 'text-3xl font-bold leading-tight tracking-tight';

export const statChange = 'text-xs text-muted-fg mt-1';

export const rowActions = 'flex gap-1.5 shrink-0';

export const sectionHead = 'flex items-center justify-between gap-3 mb-4 desk:mb-5';

/** Segmented-control tab (List/Calendar, Sign in/Create account). */
export const tabSeg = (active: boolean) =>
  'inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border-none px-3.5 py-1 text-sm font-medium transition-all duration-150 ' +
  (active ? 'bg-card text-fg shadow-xs' : 'bg-transparent text-muted-fg');

/** Filter chip. */
export const chip = (active: boolean) =>
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1 text-xs font-semibold transition-all duration-150 ' +
  (active
    ? 'border-primary bg-primary text-primary-fg'
    : 'border-border bg-card text-muted-fg hover:bg-muted');
