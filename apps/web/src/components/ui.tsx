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

/** Drag this far and letting go dismisses the panel. */
const DISMISS_AFTER = 110;

/** Backdrop opacity when the panel is at rest. */
const SCRIM_MAX = 0.5;

/** Decelerating curve — quick off the mark, soft on arrival. */
const EASE = '250ms cubic-bezier(0.32, 0.72, 0, 1)';

const DESKTOP = '(min-width: 900px)';

/**
 * Full-screen on a phone, a flush right-hand drawer on a desktop. Both slide in
 * from the edge they're anchored to. Only the phone version is draggable — a
 * pointer has a close button and Escape, a thumb doesn't.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  printable = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling body — where the save action lives. */
  footer?: ReactNode;
  printable?: boolean;
}) {
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [entered, setEntered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches,
  );
  const start = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  // Measured when a drag starts; state because the scrim reads it during render.
  const [panelSize, setPanelSize] = useState(0);

  // Desktop slides in horizontally but is never dragged; the phone sheet is.
  const progress = Math.min(1, drag / Math.max(panelSize * 0.8, 240));

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Paint once offscreen, then flip on the next frame so the browser has
  // something to animate from.
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

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (isDesktop) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = e.clientY;
    setPanelSize(panel.current?.offsetHeight ?? 0);
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragging) return;
    // Downward only — dragging up shouldn't lift the sheet off its edge.
    setDrag(Math.max(0, e.clientY - start.current));
  };

  const onPointerUp = () => {
    setDragging(false);
    if (drag > DISMISS_AFTER) onClose();
    else setDrag(0);
  };

  const dragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  const offscreen = isDesktop ? 'translateX(100%)' : 'translateY(100%)';
  const atRest = isDesktop ? 'translateX(0)' : `translateY(${drag}px)`;

  return (
    <div
      className={
        'fixed inset-0 z-100 flex items-end justify-center desk:items-stretch desk:justify-end' +
        (printable ? ' print-doc' : '')
      }
      style={{
        // Darkens on open, lightens as the panel is pulled away.
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
        className="sheet relative flex h-svh w-full flex-col overflow-hidden border-border bg-card shadow-[0_-10px_40px_rgb(0_0_0/0.15)] desk:h-full desk:w-1/3 desk:min-w-[440px] desk:max-w-[580px] desk:border-l desk:shadow-2xl"
        style={{
          transform: entered ? atRest : offscreen,
          transition: dragging ? 'none' : `transform ${EASE}`,
        }}
      >
        {/* Phone grab area: the handle and the title row both drag. */}
        <div
          className={
            'no-print shrink-0 px-4 pt-[calc(--spacing(3)+env(safe-area-inset-top))] select-none desk:px-7 desk:pt-5 ' +
            (isDesktop ? '' : 'cursor-grab touch-none active:cursor-grabbing')
          }
          {...(isDesktop ? {} : dragHandlers)}
        >
          <div
            className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted desk:hidden"
            aria-hidden="true"
          />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              className="cursor-pointer border-none bg-none p-1 text-muted-fg hover:text-fg"
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Zapri"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
        </div>

        {/* The only scroller, so its scrollbar never crosses the panel edge. */}
        <div
          className={
            'sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 desk:px-7 ' +
            (footer
              ? 'pb-4'
              : 'pb-[calc(--spacing(6)+env(safe-area-inset-bottom))] desk:pb-7')
          }
        >
          {children}
        </div>

        {footer && (
          <div className="no-print shrink-0 bg-card px-4 pt-2 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] desk:px-7 desk:pt-2 desk:pb-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  /** Replaces the hint while present — one message at a time. */
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={field}>
      <label className={labelCx} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <div className="mt-1.5 text-xs text-error-fg" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className={`${hintCx} mt-1.5`}>{hint}</div>
      ) : null}
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
