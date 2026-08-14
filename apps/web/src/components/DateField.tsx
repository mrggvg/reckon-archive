import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { Popover } from './Popover';
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  dmyToIso,
  isoOf,
  isoToDmy,
  maskDmy,
  todayIso,
} from '../lib/format';
import { input } from '../styles/cx';



/**
 * Date entry in the Slovenian written form, dd.mm.yyyy.
 *
 * A native <input type="date"> is drawn by the browser in *its* locale, so a
 * machine set to en-US shows mm/dd/yyyy no matter what the page asks for. This
 * types and displays dd.mm.yyyy and hands ISO back to the caller.
 */
export function DateField({
  id,
  value,
  onChange,
  invalid = false,
}: {
  id?: string;
  /** ISO yyyy-mm-dd, or '' when unset. */
  value: string;
  onChange: (iso: string) => void;
  invalid?: boolean;
}) {
  const [text, setText] = useState(() => isoToDmy(value));
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Follow the value when the caller changes it (prefills, resets).
  if (value !== lastValue) {
    setLastValue(value);
    setText(isoToDmy(value));
  }

  const anchor = value || todayIso();
  const [view, setView] = useState(() => anchor.slice(0, 7));
  const [year, month] = view.split('-').map(Number) as [number, number];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The calendar lives in a portal, so it isn't inside `wrap`.
      if (!wrap.current?.contains(target) && !panel.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const type = (raw: string) => {
    const masked = maskDmy(raw);
    setText(masked);
    if (masked === '') {
      onChange('');
      return;
    }
    const iso = dmyToIso(masked);
    if (iso) {
      onChange(iso);
      setLastValue(iso);
      setView(iso.slice(0, 7));
    }
  };

  const openCalendar = () => {
    setView((value || todayIso()).slice(0, 7));
    setOpen((o) => !o);
  };

  const pick = (day: number) => {
    const iso = isoOf(new Date(year, month - 1, day));
    onChange(iso);
    setLastValue(iso);
    setText(isoToDmy(iso));
    setOpen(false);
    field.current?.focus();
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setView(isoOf(d).slice(0, 7));
  };

  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = todayIso();

  // A half-typed date isn't wrong yet — only complain once it's complete.
  const malformed = text.length === 10 && dmyToIso(text) === null;

  return (
    <div className="relative" ref={wrap}>
      <input
        id={id}
        ref={field}
        className={input + (invalid || malformed ? ' border-destructive' : '') + ' pr-11'}
        type="text"
        inputMode="numeric"
        placeholder="dd.mm.yyyy"
        maxLength={10}
        value={text}
        aria-invalid={invalid || malformed ? true : undefined}
        onChange={(e) => type(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted-fg hover:text-fg"
        onClick={openCalendar}
        aria-label="Odpri koledar"
        aria-expanded={open}
      >
        <CalendarIcon className="size-4" />
      </button>

      <Popover
        anchor={wrap}
        open={open}
        onClose={() => setOpen(false)}
        width={288}
        maxHeight={340}
      >
        <div className="p-2" ref={panel}>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
              onClick={() => shiftMonth(-1)}
              aria-label="Prejšnji mesec"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <span className="text-sm font-semibold">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              type="button"
              className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
              onClick={() => shiftMonth(1)}
              aria-label="Naslednji mesec"
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5" aria-hidden="true">
            {WEEKDAY_NAMES.map((w) => (
              <span
                key={w}
                className="py-1 text-center font-mono text-2xs uppercase text-muted-fg"
              >
                {w.slice(0, 2)}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <span key={'b' + i} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const iso = isoOf(new Date(year, month - 1, day));
              const selected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(day)}
                  className={
                    'flex h-8 cursor-pointer items-center justify-center rounded-md font-mono text-xs ' +
                    (selected
                      ? 'bg-primary text-primary-fg'
                      : iso === today
                        ? 'border border-primary text-primary'
                        : 'hover:bg-muted')
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </Popover>
    </div>
  );
}
