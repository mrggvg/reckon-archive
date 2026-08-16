import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDownIcon, PlusIcon } from './icons';
import { Popover } from './Popover';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional right-aligned detail, e.g. an hourly rate. */
  hint?: string;
}

/**
 * Listbox replacement for <select>. A native select's dropdown is drawn by the
 * OS and can't be styled, so it always looked borrowed from another app.
 */
export function Select({
  id,
  value,
  options,
  onChange,
  placeholder = 'Izberi …',
  emptyLabel = 'Ni možnosti za izbiro',
  action,
}: {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  /** Optional row at the foot of the list, e.g. "add a new one". */
  action?: { label: string; onSelect: () => void };
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // Close on any click that isn't ours.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The list is portalled, so it isn't inside `wrap`.
      if (!wrap.current?.contains(target) && !list.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const openList = () => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className="relative" ref={wrap}>
      <button
        id={id}
        ref={trigger}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={
          'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-left text-base text-fg transition-colors outline-none desk:py-2 desk:text-sm ' +
          (open
            ? 'border-primary ring-3 ring-primary/15'
            : 'border-input-border hover:border-fg focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15')
        }
      >
        <span className={'truncate ' + (selected ? '' : 'text-muted-fg')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon
          className={
            'size-4 shrink-0 text-muted-fg transition-transform duration-150 ' +
            (open ? 'rotate-180' : '')
          }
        />
      </button>

      <Popover anchor={wrap} open={open} onClose={() => setOpen(false)} maxHeight={240}>
        <ul id={listId} role="listbox" aria-label="Možnosti" className="p-1" ref={list}>
          {options.length === 0 && !action && (
            <li className="px-3 py-2 text-sm text-muted-fg">{emptyLabel}</li>
          )}
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={
                  'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm desk:py-2 ' +
                  (isSelected
                    ? 'bg-primary text-primary-fg'
                    : i === active
                      ? 'bg-muted text-fg'
                      : 'text-fg')
                }
              >
                <span className="truncate">{o.label}</span>
                {o.hint && (
                  <span
                    className={
                      'shrink-0 font-mono text-xs ' +
                      (isSelected ? 'text-primary-fg/80' : 'text-muted-fg')
                    }
                  >
                    {o.hint}
                  </span>
                )}
              </li>
            );
          })}

          {action && (
            <li
              // No rule above it — the gap and the primary colour already set
              // it apart from the choices.
              className={
                'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted desk:py-2 ' +
                (options.length > 0 ? 'mt-2' : '')
              }
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              <PlusIcon className="size-3.5" />
              {action.label}
            </li>
          )}
        </ul>
      </Popover>
    </div>
  );
}
