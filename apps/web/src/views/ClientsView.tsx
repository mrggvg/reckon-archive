import { EmptyState, SectionHead } from '../components/ui';
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
          className="btn btn-primary btn-sm desktop-only"
          onClick={() => openSheet({ kind: 'client' })}
        >
          + New client
        </button>
      </SectionHead>

      {data.clients.length === 0 ? (
        <EmptyState
          glyph="＋"
          lines={['No clients yet.', 'Add the company that hires you as a subcontractor.']}
        />
      ) : (
        data.clients.map((c) => (
          <div className="row-card" key={c.id}>
            <div>
              <div className="name">{c.name}</div>
              <div className="addr">{c.address || 'No address on file'}</div>
              <div className="taxno">
                {c.taxNumber || 'no tax no.'}
                {c.email ? ' · ' + c.email : ''}
                {c.phone ? ' · ' + c.phone : ''}
              </div>
              <div className="rate">{fmtMoney(c.rate)}/h</div>
            </div>
            <div className="row-actions">
              <button
                className="icon-btn"
                onClick={() => openSheet({ kind: 'client', editing: c })}
                aria-label="Edit client"
              >
                ✎
              </button>
              <button
                className="icon-btn"
                onClick={() => remove(c.id)}
                aria-label="Delete client"
              >
                🗑
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
