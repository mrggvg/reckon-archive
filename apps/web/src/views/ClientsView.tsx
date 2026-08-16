import {
  ClientsIcon,
  EditIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from '../components/icons';
import { formatAddress } from '@reckon/shared';
import { EmptyState, SectionHead } from '../components/ui';
import { failureMessage, } from '../lib/failure';
import { plural } from '../lib/format';
import { btn, btnSm, iconBtn, rowActions } from '../styles/cx';
import { fmtMoney } from '../lib/format';
import type { OpenSheet } from '../lib/sheets';
import { useStore } from '../store/context';

export function ClientsView({ openSheet }: { openSheet: OpenSheet }) {
  const { data, removeClient, setClientActive, toast } = useStore();

  /**
   * A client that has been worked for or invoiced is deactivated rather than
   * deleted — the hours behind an issued invoice have to keep pointing at
   * someone. Only a client nothing refers to is actually removed.
   */
  const remove = async (id: string) => {
    if (
      !confirm(
        'Odstranim to stranko? Če ima zabeležene ure ali račune, bo le označena kot neaktivna.',
      )
    ) {
      return;
    }
    try {
      const deactivated = await removeClient(id);
      toast(deactivated ? 'Stranka označena kot neaktivna' : 'Stranka izbrisana');
    } catch (err) {
      toast(failureMessage(err));
    }
  };

  const reactivate = async (id: string) => {
    try {
      await setClientActive(id, true);
      toast('Stranka je spet aktivna');
    } catch (err) {
      toast(failureMessage(err));
    }
  };

  return (
    <>
      <SectionHead
        title="Stranke"
        meta={
          data.clients.length > 0
            ? plural(data.clients.length, [
                'stranka',
                'stranki',
                'stranke',
                'strank',
              ])
            : undefined
        }
      >
        <button
          className={`${btn.primary} ${btnSm} max-desk:hidden`}
          onClick={() => openSheet({ kind: 'client' })}
        >
          <PlusIcon className="size-3.5" />
          Nova stranka
        </button>
      </SectionHead>

      {data.clients.length === 0 ? (
        <EmptyState
          icon={<ClientsIcon className="size-8" />}
          lines={[
            'Ni vnesenih strank.',
            'Dodajte podjetje, za katerega opravljate storitve.',
          ]}
        />
      ) : (
        data.clients.map((c) => (
          <div
            className={
              'mb-3 flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs ' +
              (c.isActive ? '' : 'opacity-60')
            }
            key={c.id}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">{c.name}</span>
                {!c.isActive && (
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-2xs uppercase tracking-wider text-muted-fg">
                    neaktivna
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-muted-fg">
                {formatAddress(c) || 'Naslov ni vnesen'}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-fg">
                {c.taxNumber || 'brez davčne št.'}
                {c.email ? ' · ' + c.email : ''}
                {c.phone ? ' · ' + c.phone : ''}
              </div>
              <div className="mt-2 font-mono text-sm font-semibold text-primary">
                {fmtMoney(c.rate)}/h
              </div>
            </div>
            <div className={rowActions}>
              <button
                className={iconBtn}
                onClick={() => openSheet({ kind: 'client', editing: c })}
                aria-label="Uredi stranko"
              >
                <EditIcon className="size-4" />
              </button>
              {c.isActive ? (
                <button
                  className={iconBtn}
                  onClick={() => void remove(c.id)}
                  aria-label="Odstrani stranko"
                >
                  <TrashIcon className="size-4" />
                </button>
              ) : (
                <button
                  className={iconBtn}
                  onClick={() => void reactivate(c.id)}
                  aria-label="Ponovno aktiviraj stranko"
                >
                  <RepeatIcon className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}
