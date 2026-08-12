const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
};

export function ClockIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ClientsIcon() {
  return (
    <svg {...common}>
      <path d="M4 20c0-3.5 3-5.5 6-5.5s6 2 6 5.5" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M16 9.5c1.8.2 3 1.6 3 3.3" />
      <circle cx="17.5" cy="7" r="2.2" />
    </svg>
  );
}

export function InvoiceIcon() {
  return (
    <svg {...common}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg {...common}>
      <path d="M4 19V10M11 19V5M18 19v-7" />
    </svg>
  );
}

export function TaxIcon() {
  return (
    <svg {...common}>
      <path d="M12 3v18M8 7.5c0-1.5 1.5-2.5 4-2.5s4 1.2 4 2.8-1.6 2.4-4 2.7-4 1.3-4 2.9 1.6 2.6 4 2.6 4-.9 4-2.4" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg {...common} width="18" height="18">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}
