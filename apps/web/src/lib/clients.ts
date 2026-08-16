import type { Client } from './types';

/**
 * The clients a picker should offer.
 *
 * Deactivated clients leave the lists but not the records, so one that is
 * already selected — on an invoice being edited, say — stays in its own picker
 * rather than disappearing and silently reassigning the document.
 */
export function selectableClients(clients: Client[], selectedId?: string): Client[] {
  return clients.filter((c) => c.isActive || c.id === selectedId);
}

/** The first client a new form should default to, if there is one. */
export function defaultClientId(clients: Client[]): string {
  return clients.find((c) => c.isActive)?.id ?? '';
}
