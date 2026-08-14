/*
 * Feather icons (https://feathericons.com, MIT). Paths copied verbatim from the
 * icon set — 24x24, 2px stroke, round caps — so they stay on-system.
 */
import type { ReactNode } from 'react';

function Icon({ className = 'size-4', children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}


/** feather: clock */
export function ClockIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </Icon>
  );
}

/** feather: users */
export function ClientsIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

/** feather: file-text */
export function InvoiceIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </Icon>
  );
}



/** feather: user */
export function UserIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </Icon>
  );
}

/** feather: log-out */
export function SignOutIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  );
}

/** feather: edit-2 */
export function EditIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Icon>
  );
}

/** feather: trash-2 */
export function TrashIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </Icon>
  );
}

/** feather: x */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  );
}

/** feather: plus */
export function PlusIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  );
}

/** feather: chevron-left */
export function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <polyline points="15 18 9 12 15 6" />
    </Icon>
  );
}

/** feather: chevron-right */
export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <polyline points="9 18 15 12 9 6" />
    </Icon>
  );
}

/** feather: chevron-up */
export function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <polyline points="18 15 12 9 6 15" />
    </Icon>
  );
}

/** feather: chevron-down */
export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <polyline points="6 9 12 15 18 9" />
    </Icon>
  );
}

/** feather: arrow-left */
export function BackIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </Icon>
  );
}

/** feather: repeat */
export function RepeatIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </Icon>
  );
}

/** feather: download */
export function DownloadIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </Icon>
  );
}

/** feather: upload */
export function UploadIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </Icon>
  );
}

/** feather: printer */
export function PrinterIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
    </Icon>
  );
}

/** feather: list */
export function ListIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </Icon>
  );
}

/** feather: alert-triangle */
export function AlertIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </Icon>
  );
}

/** feather: file-plus */
export function FilePlusIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
    </Icon>
  );
}

/** feather: calendar */
export function CalendarIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </Icon>
  );
}

/** feather: credit-card */
export function BillingIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </Icon>
  );
}
