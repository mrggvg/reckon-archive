import { useMemo, useState, type ReactNode } from 'react';

/*
 * The same records as the card lists, in rows and columns.
 *
 * A card is the right shape for reading one thing at a time on a phone; a table
 * is the right shape for comparing many at once, which is what a ledger is for.
 * The two views draw from the same data and offer the same actions — this is a
 * different arrangement of a screen, not a different screen.
 *
 * Wide content scrolls inside its own box. The page itself must never scroll
 * sideways, so the table sits in an overflow-x container and keeps its columns
 * at their natural width rather than crushing them to fit a phone.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Money, hours, dates: right-aligned so the digits line up. */
  align?: 'left' | 'right';
  /** Dropped on phones, where the width has to be spent on the essentials. */
  deskOnly?: boolean;
  cell: (row: T) => ReactNode;
  /** Supply to make the column sortable. */
  sortBy?: (row: T) => string | number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowLabel,
  dimmed,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** What a screen reader should announce for the row's own action. */
  rowLabel?: (row: T) => string;
  /** Rows that are no longer current — deactivated clients, billed hours. */
  dimmed?: (row: T) => boolean;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);

  const ordered = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortBy) return rows;
    const by = column.sortBy;
    // A copy: the caller's order is the fallback the table returns to.
    return [...rows].sort((a, b) => {
      const av = by(a);
      const bv = by(b);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'sl');
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, sort, columns]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, desc: !s.desc } : { key, desc: false }));

  return (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sort?.key === c.key
                    ? sort.desc
                      ? 'descending'
                      : 'ascending'
                    : undefined
                }
                className={
                  'px-3 py-2 font-mono text-2xs font-semibold uppercase tracking-wider text-muted-fg ' +
                  (c.align === 'right' ? 'text-right ' : 'text-left ') +
                  (c.deskOnly ? 'max-desk:hidden ' : '')
                }
              >
                {c.sortBy ? (
                  <button
                    type="button"
                    className={
                      'inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider transition-colors hover:text-fg ' +
                      (sort?.key === c.key ? 'text-fg' : '')
                    }
                    onClick={() => toggle(c.key)}
                  >
                    {c.header}
                    {/*
                      The arrow appears only on the column in use. A set of them
                      on every header is decoration that has to be read past.
                    */}
                    {sort?.key === c.key && (
                      <span aria-hidden="true">{sort.desc ? '▾' : '▴'}</span>
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr
              key={rowKey(row)}
              {...(onRowClick
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': rowLabel?.(row),
                    onClick: () => onRowClick(row),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    },
                  }
                : {})}
              className={
                'border-b border-border last:border-b-0 transition-colors ' +
                (onRowClick
                  ? 'cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none '
                  : '') +
                (dimmed?.(row) ? 'opacity-60 ' : '')
              }
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={
                    'px-3 py-2.5 align-middle ' +
                    (c.align === 'right' ? 'text-right ' : '') +
                    (c.deskOnly ? 'max-desk:hidden ' : '')
                  }
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
