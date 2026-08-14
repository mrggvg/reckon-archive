import { useEffect, useRef, useState } from 'react';
import { ClockIcon } from './icons';
import { Popover } from './Popover';
import { isValidTime, maskTime, normaliseTime } from '../lib/format';
import { input } from '../styles/cx';

/** Rows are h-8; the list scrolls the selection roughly into the middle. */
const ROW = 32;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

/**
 * Time entry on a 24-hour clock: type it, or click it out of the two columns.
 *
 * Like the date field, this exists because a native <input type="time"> is
 * drawn in the browser's locale — an en-US machine offers AM/PM, which is not
 * how anyone here writes a shift.
 */
export function TimeField({
  id,
  value,
  onChange,
  invalid = false,
}: {
  id?: string;
  /** HH:mm, or '' when unset. */
  value: string;
  onChange: (time: string) => void;
  invalid?: boolean;
}) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  // Close on a click anywhere else, or on Escape. The columns are portalled,
  // so they aren't inside `wrap` and have to be checked separately.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!wrap.current?.contains(target) && !panel.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const commit = (next: string) => {
    setText(next);
    setLastValue(next);
    onChange(next);
  };

  const type = (raw: string) => {
    const masked = maskTime(raw);
    setText(masked);
    if (masked === '') onChange('');
    else if (isValidTime(masked)) commit(masked);
  };

  // "9" and "930" only become 09:00 and 09:30 once you leave the field, so
  // they don't fight you mid-keystroke.
  const settle = () => {
    if (text === '') return;
    const settled = normaliseTime(text);
    if (settled) commit(settled);
  };

  const [hh, mm] = (isValidTime(text) ? text : '09:00').split(':') as [string, string];
  const malformed = text.length > 0 && !isValidTime(text);

  const column = (
    values: string[],
    selected: string,
    onPick: (v: string) => void,
    heading: string,
  ) => (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="px-2 pb-1 text-center font-mono text-2xs uppercase tracking-wider text-muted-fg">
        {heading}
      </div>
      <div
        className="max-h-52 overflow-y-auto overscroll-contain"
        ref={(el) => {
          if (el) el.scrollTop = Math.max(0, values.indexOf(selected) * ROW - 2 * ROW);
        }}
      >
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className={
              'flex h-8 w-full cursor-pointer items-center justify-center rounded-md font-mono text-sm ' +
              (v === selected ? 'bg-primary text-primary-fg' : 'hover:bg-muted')
            }
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative" ref={wrap}>
      <input
        id={id}
        className={input + (invalid || malformed ? ' border-destructive' : '') + ' pr-11'}
        type="text"
        inputMode="numeric"
        placeholder="hh:mm"
        maxLength={5}
        value={text}
        aria-invalid={invalid || malformed ? true : undefined}
        onChange={(e) => type(e.target.value)}
        onBlur={settle}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted-fg hover:text-fg"
        onClick={() => setOpen((o) => !o)}
        aria-label="Izberi uro"
        aria-expanded={open}
      >
        <ClockIcon className="size-4" />
      </button>

      <Popover
        anchor={wrap}
        open={open}
        onClose={() => setOpen(false)}
        width={200}
        maxHeight={260}
      >
        <div className="flex gap-1 p-2" ref={panel}>
          {column(HOURS, hh, (v) => commit(`${v}:${mm}`), 'Ura')}
          {column(MINUTES, mm, (v) => {
            commit(`${hh}:${v}`);
            setOpen(false);
          }, 'Min')}
        </div>
      </Popover>
    </div>
  );
}
