import { useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

interface Position {
  top: number;
  left: number;
  width: number;
}

/**
 * A panel anchored to a trigger but rendered at the end of <body>.
 *
 * Anchored panels can't live next to their trigger here: the sheet body is a
 * scroll container (so the panel gets clipped and slides out of alignment) and
 * the sheet itself is transformed, which would make `position: fixed` resolve
 * against the sheet rather than the viewport. Portalling sidesteps both, at the
 * cost of having to place it by hand.
 */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  width,
  maxHeight = 340,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Defaults to the trigger's own width. */
  width?: number;
  maxHeight?: number;
}) {
  const [pos, setPos] = useState<Position | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  // Drop stale coordinates the moment it closes, so reopening can't flash the
  // panel at its previous location for a frame.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setPos(null);
  }

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      // Scrolled out of sight — nothing to point at any more.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        onClose();
        return;
      }

      const w = width ?? rect.width;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const dropDown = below >= maxHeight + 8 || below >= above;

      setPos({
        top: dropDown ? rect.bottom + 4 : Math.max(8, rect.top - maxHeight - 4),
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - w - 8)),
        width: w,
      });
    };

    // First placement on the next frame, then follow the trigger as things move.
    const frame = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, width, maxHeight, onClose]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-200 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card shadow-lg"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight }}
    >
      {children}
    </div>,
    document.body,
  );
}
