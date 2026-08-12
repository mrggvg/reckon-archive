import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function Sheet({
  title,
  onClose,
  children,
  printable = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  printable?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={'overlay' + (printable ? ' print-doc' : '')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ glyph, lines }: { glyph: string; lines: string[] }) {
  return (
    <div className="empty">
      <div className="glyph">{glyph}</div>
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone,
  change,
}: {
  label: string;
  value: ReactNode;
  tone?: 'primary' | 'ahead' | 'behind';
  change?: ReactNode;
}) {
  return (
    <div className={'stat-card' + (tone ? ' ' + tone : '')}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {change ? <div className="stat-change">{change}</div> : null}
    </div>
  );
}

export function SectionHead({
  title,
  count,
  children,
}: {
  title: string;
  count?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="section-head">
      <h1>{title}</h1>
      {count !== undefined ? <span className="count">{count}</span> : null}
      {children}
    </div>
  );
}
