import { ClientsIcon, EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { EmptyState, SectionHead } from '../components/ui';
import { btn, btnSm, iconBtn, rowActions } from '../styles/cx';
import { fmtMoney } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';

export function ClientsView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, update, toast } = useStore();

  const remove = (id: string) => {
    if (
      !confirm('Delete this client? Logged hours for them will stay but become unassigned.')
    ) {
      return;
    }
    update((d) => {
      d.clients = d.clients.filter((c) => c.id !== id);
    });
    toast('Client deleted');
  };

  return (
    <>
      <SectionHead title="Clients" count={data.clients.length}>
        <button
          className={`${btn.primary} ${btnSm} max-desk:hidden`}
          onClick={() => openSheet({ kind: 'client' })}
        >
          <PlusIcon className="size-3.5" />
          New client
        </button>
      </SectionHead>

      {data.clients.length === 0 ? (
        <EmptyState
          icon={<ClientsIcon className="size-8" />}
          lines={['No clients yet.', 'Add the company that hires you as a subcontractor.']}
        />
      ) : (
        data.clients.map((c) => (
          <div
            className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
            key={c.id}
          >
            <div>
              <div className="text-base font-semibold">{c.name}</div>
              <div className="mt-0.5 text-sm text-muted-fg">{c.address || 'No address on file'}</div>
              <div className="mt-1 font-mono text-xs text-muted-fg">
                {c.taxNumber || 'no tax no.'}
                {c.email ? ' · ' + c.email : ''}
                {c.phone ? ' · ' + c.phone : ''}
              </div>
              <div className="mt-2 font-mono text-sm font-semibold text-primary">{fmtMoney(c.rate)}/h</div>
            </div>
            <div className={rowActions}>
              <button
                className={iconBtn}
                onClick={() => openSheet({ kind: 'client', editing: c })}
                aria-label="Edit client"
              >
                <EditIcon className="size-4" />
              </button>
              <button
                className={iconBtn}
                onClick={() => remove(c.id)}
                aria-label="Delete client"
              >
                <TrashIcon className="size-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
