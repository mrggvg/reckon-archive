import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { CloseIcon } from './icons';
import {
  field,
  hint as hintCx,
  label as labelCx,
  statCard,
  statChange,
  statLabel,
  statValue,
} from '../styles/cx';

/** Drag this far down and letting go dismisses the sheet. */
const DISMISS_AFTER = 110;

/** Backdrop opacity when the sheet is at rest. */
const SCRIM_MAX = 0.5;

/** Decelerating curve — quick off the mark, soft on arrival. */
const EASE = '250ms cubic-bezier(0.32, 0.72, 0, 1)';

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
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  // Measured when a drag starts; state rather than a ref, because the scrim
  // opacity below is computed from it during render.
  const [panelHeight, setPanelHeight] = useState(0);
  const [entered, setEntered] = useState(false);

  // How far through a dismissal the drag is, measured against the sheet's own
  // height so a tall sheet doesn't fade out in the first centimetre.
  const progress = Math.min(1, dragY / Math.max(panelHeight * 0.8, 240));

  // Paint once in the offscreen state, then flip on the next frame so the
  // browser has something to animate from.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Pointer events cover mouse and touch with one path.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    setPanelHeight(panel.current?.offsetHeight ?? 0);
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    // Downward only — dragging up shouldn't lift the sheet off its edge.
    setDragY(Math.max(0, e.clientY - startY.current));
  };

  const onPointerUp = () => {
    setDragging(false);
    if (dragY > DISMISS_AFTER) onClose();
    else setDragY(0);
  };

  return (
    <div
      className={
        'fixed inset-0 z-100 flex items-end justify-center desk:items-center desk:p-6' +
        (printable ? ' print-doc' : '')
      }
      style={{
        // Darkens on open, lightens as the sheet is pulled away.
        backgroundColor: `rgb(0 0 0 / ${entered ? SCRIM_MAX * (1 - progress) : 0})`,
        transition: dragging ? 'none' : `background-color ${EASE}`,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panel}
        className="sheet flex max-h-[90svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-card shadow-[0_-10px_40px_rgb(0_0_0/0.15)] desk:max-h-[90vh] desk:w-[560px] desk:max-w-[95vw] desk:rounded-2xl desk:border-b desk:shadow-2xl"
        style={{
          transform: entered ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragging ? 'none' : `transform ${EASE}`,
        }}
      >
        {/* Grab area: the handle and the title row both drag. */}
        <div
          className="no-print shrink-0 cursor-grab touch-none select-none px-4 pt-3 active:cursor-grabbing desk:px-7 desk:pt-5"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted transition-colors hover:bg-input-border"
            aria-hidden="true"
          />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              className="cursor-pointer border-none bg-none p-1 text-muted-fg hover:text-fg"
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
        </div>

        {/* The only scroller, so its scrollbar never crosses the rounded corners. */}
        <div className="sheet-body min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(--spacing(5)+env(safe-area-inset-bottom))] desk:px-7 desk:pb-7">
          {children}
        </div>
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
    <div className={field}>
      <label className={labelCx} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <div className={`${hintCx} mt-1.5`}>{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, lines }: { icon: ReactNode; lines: string[] }) {
  return (
    <div className="px-5 py-12 text-center text-muted-fg">
      <div className="mb-3 flex justify-center opacity-35">{icon}</div>
      {lines.map((l) => (
        <p key={l} className="my-1 text-sm">
          {l}
        </p>
      ))}
    </div>
  );
}

const statTone = {
  primary: 'text-primary',
  ahead: 'text-secondary',
  behind: 'text-destructive',
};

export function StatCard({
  label,
  value,
  tone,
  change,
}: {
  label: string;
  value: ReactNode;
  tone?: keyof typeof statTone;
  change?: ReactNode;
}) {
  return (
    <div className={statCard}>
      <div className={statLabel}>{label}</div>
      <div className={`${statValue} ${tone ? statTone[tone] : ''}`}>{value}</div>
      {change ? <div className={statChange}>{change}</div> : null}
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
    <div className="mb-4 flex items-center justify-between gap-3 desk:mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {count !== undefined ? (
        <span className="font-mono text-xs text-muted-fg">{count}</span>
      ) : null}
      {children}
    </div>
  );
}
