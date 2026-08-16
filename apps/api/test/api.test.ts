/*
 * Integration tests against a real Postgres.
 *
 * These cover the things the browser can't be trusted to enforce and the
 * frontend tests can't reach: that one account cannot see another's records,
 * that invoice numbers stay unique under concurrency, and that billed hours
 * are frozen. They run against a scratch database, created and dropped here.
 *
 *   npm test        (apps/api)
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import pg from 'pg';

const ADMIN_URL = 'postgres://reckon:reckon@localhost:5432/reckon';
const TEST_DB = 'reckon_test';
const TEST_URL = `postgres://reckon:reckon@localhost:5432/${TEST_DB}`;

process.env.DATABASE_URL = TEST_URL;
process.env.SESSION_SECRET = 'test-secret-that-is-at-least-32-characters';
process.env.NODE_ENV = 'test';
// The limiter is exercised on its own below; a whole suite of registrations
// from one address would otherwise trip a limit meant for the open internet.
process.env.AUTH_RATE_LIMIT_MAX = '500';

let server: Server;
let base: string;

/** A logged-in caller: keeps its own cookie, like a browser would. */
class Client {
  cookie = '';

  constructor(private readonly origin: string) {}

  async request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${this.origin}/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0] as string;
    const text = await res.text();
    return {
      status: res.status,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    };
  }

  get = (p: string) => this.request('GET', p);
  post = (p: string, b?: unknown) => this.request('POST', p, b);
  put = (p: string, b: unknown) => this.request('PUT', p, b);
  patch = (p: string, b: unknown) => this.request('PATCH', p, b);
  del = (p: string) => this.request('DELETE', p);
}

const CLIENT = {
  name: 'Vikram d.o.o.',
  street: 'Trg 1',
  postalCode: '6000',
  city: 'Koper',
  taxNumber: '29825962',
  rate: 28,
  email: '',
  phone: '',
};

const PROFILE = {
  name: 'Amar Ustavdić s.p.',
  street: 'Izletniška pot 52',
  postalCode: '6000',
  city: 'Koper',
  taxNumber: '82426490',
  regNumber: '',
  iban: 'SI56101000058079036',
  accountHolder: '',
  vatPayer: 'NE',
  defaultDesc: '',
  nextInvoiceNumber: '',
  placeOfIssue: 'Koper',
  vatClause: 'Nisem zavezanec za DDV po 1. odstavku 94. člena ZDDV-1.',
};

async function signUp(email: string) {
  const c = new Client(base);
  const res = await c.post('/auth/register', { email, password: 'test-password' });
  assert.equal(res.status, 201, `register ${email}: ${JSON.stringify(res.body)}`);
  return c;
}

before(async () => {
  // A scratch database, migrated from the same files production uses.
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  execFileSync('node', ['../../scripts/migrate.mjs'], {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'pipe',
  });

  const { app } = await import('../src/app.js');
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const { pool } = await import('../src/db/pool.js');
  await pool.end();

  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.end();
});

describe('authentication', () => {
  it('refuses everything without a session', async () => {
    const anon = new Client(base);
    for (const path of ['/bootstrap', '/profile', '/clients', '/sessions', '/invoices']) {
      assert.equal((await anon.get(path)).status, 401, path);
    }
  });

  it('registers, identifies, and logs out', async () => {
    const c = await signUp('auth@example.com');
    const me = await c.get('/auth/me');
    assert.equal(me.status, 200);
    assert.equal((me.body?.user as { email: string }).email, 'auth@example.com');

    assert.equal((await c.post('/auth/logout')).status, 204);
    assert.equal((await c.get('/auth/me')).status, 401);
  });

  it('will not register the same address twice', async () => {
    await signUp('dupe@example.com');
    const again = new Client(base);
    const res = await again.post('/auth/register', {
      email: 'dupe@example.com',
      password: 'test-password',
    });
    assert.equal(res.status, 409);
  });

  it('gives the same answer for a wrong password and an unknown address', async () => {
    const c = new Client(base);
    const unknown = await c.post('/auth/login', {
      email: 'nobody@example.com',
      password: 'test-password',
    });
    const wrong = await c.post('/auth/login', {
      email: 'dupe@example.com',
      password: 'not-the-password',
    });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.deepEqual(unknown.body, wrong.body);
  });
});

describe('account isolation', () => {
  it('keeps one account entirely out of another', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');

    const client = (await a.post('/clients', CLIENT)).body as { id: string };
    const session = (
      await a.post('/sessions', {
        clientId: client.id,
        date: '2026-05-06',
        start: '09:00',
        end: '13:30',
        note: '',
      })
    ).body as { id: string };

    // B sees nothing of A's, by id or in a listing.
    assert.equal((await b.get(`/clients/${client.id}`)).status, 404);
    assert.equal((await b.put(`/clients/${client.id}`, CLIENT)).status, 404);
    assert.equal((await b.del(`/clients/${client.id}`)).status, 404);
    assert.equal((await b.del(`/sessions/${session.id}`)).status, 404);
    assert.deepEqual((await b.get('/clients')).body, []);
    assert.deepEqual((await b.get('/sessions')).body, []);

    // And A still has both.
    assert.equal(((await a.get('/clients')).body as unknown[]).length, 1);
    assert.equal(((await a.get('/sessions')).body as unknown[]).length, 1);
  });

  it('will not let one account bill another\'s hours', async () => {
    const a = await signUp('bill-a@example.com');
    const b = await signUp('bill-b@example.com');
    await b.put('/profile', PROFILE);

    const clientA = (await a.post('/clients', CLIENT)).body as { id: string };
    const sessionA = (
      await a.post('/sessions', {
        clientId: clientA.id,
        date: '2026-05-06',
        start: '09:00',
        end: '13:30',
        note: '',
      })
    ).body as { id: string };
    const clientB = (await b.post('/clients', CLIENT)).body as { id: string };

    const res = await b.post('/invoices', {
      clientId: clientB.id,
      sessionIds: [sessionA.id],
      issueDate: '2026-05-31',
      dueDate: '2026-06-14',
      description: 'Storitve',
    });
    assert.equal(res.status, 409);
    assert.deepEqual((await b.get('/invoices')).body, []);
  });
});

describe('invoicing', () => {
  it('prices an invoice from the hours and freezes them', async () => {
    const c = await signUp('gen@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    const ids: string[] = [];
    for (const [date, start, end] of [
      ['2026-05-06', '09:00', '13:30'],
      ['2026-05-07', '08:30', '16:00'],
    ] as const) {
      const s = (await c.post('/sessions', { clientId: client.id, date, start, end, note: '' }))
        .body as { id: string };
      ids.push(s.id);
    }

    const res = await c.post('/invoices', {
      clientId: client.id,
      sessionIds: ids,
      issueDate: '2026-05-31',
      dueDate: '2026-06-14',
      description: 'Reševanje iz vode',
    });
    assert.equal(res.status, 201);
    const invoice = res.body as Record<string, unknown>;

    // 4.5 h + 7.5 h at 28,00 €/h
    assert.equal(invoice.totalHours, 12);
    assert.equal(invoice.total, 336);
    assert.equal(invoice.rate, 28);
    assert.equal(invoice.number, '001/2026');
    assert.equal(invoice.periodStart, '2026-05-06');
    assert.equal(invoice.periodEnd, '2026-05-07');
    // The customer as printed, snapshotted onto the document.
    assert.equal(invoice.clientName, CLIENT.name);
    assert.equal(invoice.clientAddress, 'Trg 1, 6000 Koper');

    const sessions = (await c.get('/sessions')).body as { invoiced: boolean }[];
    assert.ok(sessions.every((s) => s.invoiced));

    // Billed hours are frozen.
    const edit = await c.put(`/sessions/${ids[0]}`, {
      clientId: client.id,
      date: '2026-05-09',
      start: '09:00',
      end: '13:30',
      note: 'moved',
    });
    assert.equal(edit.status, 409);
    assert.equal((await c.del(`/sessions/${ids[0]}`)).status, 409);

    // The same hours cannot reach a second invoice.
    const again = await c.post('/invoices', {
      clientId: client.id,
      sessionIds: ids,
      issueDate: '2026-05-31',
      dueDate: '2026-06-14',
      description: '',
    });
    assert.equal(again.status, 409);
  });

  it('continues the numbering declared in the profile', async () => {
    const c = await signUp('numbering@example.com');
    await c.put('/profile', { ...PROFILE, nextInvoiceNumber: '003/2026' });
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    const makeInvoice = async () => {
      const s = (
        await c.post('/sessions', {
          clientId: client.id,
          date: '2026-06-01',
          start: '09:00',
          end: '10:00',
          note: '',
        })
      ).body as { id: string };
      return c.post('/invoices', {
        clientId: client.id,
        sessionIds: [s.id],
        issueDate: '2026-06-30',
        dueDate: '2026-07-14',
        description: '',
      });
    };

    assert.equal(((await makeInvoice()).body as { number: string }).number, '003/2026');
    assert.equal(((await makeInvoice()).body as { number: string }).number, '004/2026');
  });

  it('never hands a deleted invoice\'s number to the next one', async () => {
    const c = await signUp('reuse@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    const issue = async (day: string) => {
      const s = (
        await c.post('/sessions', {
          clientId: client.id, date: day, start: '09:00', end: '10:00', note: '',
        })
      ).body as { id: string };
      return (
        await c.post('/invoices', {
          clientId: client.id,
          sessionIds: [s.id],
          issueDate: '2026-03-31',
          dueDate: '2026-04-14',
          description: '',
        })
      ).body as { id: string; number: string };
    };

    const first = await issue('2026-03-01');
    assert.equal(first.number, '001/2026');

    // 001 has been issued and possibly sent. Deleting it must not free it.
    assert.equal((await c.del(`/invoices/${first.id}`)).status, 204);
    const second = await issue('2026-03-02');
    assert.equal(second.number, '002/2026', 'the number was not reused');

    // The profile's declared number reflects the high-water mark.
    assert.equal(
      ((await c.get('/profile')).body as { nextInvoiceNumber: string })
        .nextInvoiceNumber,
      '003/2026',
    );
  });

  it('counts an imported number as spent as well', async () => {
    const c = await signUp('importfloor@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    await c.post('/invoices/import', {
      number: '050/2026',
      clientId: client.id,
      issueDate: '2026-02-01',
      dueDate: '2026-02-15',
      description: 'Storitve',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      total: 100,
      status: 'unpaid',
      paidDate: null,
    });

    const s = (
      await c.post('/sessions', {
        clientId: client.id, date: '2026-02-20', start: '09:00', end: '10:00', note: '',
      })
    ).body as { id: string };
    const generated = (
      await c.post('/invoices', {
        clientId: client.id,
        sessionIds: [s.id],
        issueDate: '2026-02-28',
        dueDate: '2026-03-14',
        description: '',
      })
    ).body as { number: string };
    assert.equal(generated.number, '051/2026');
  });

  it('starts a new year at 001 regardless of last year\'s floor', async () => {
    const c = await signUp('newyear@example.com');
    await c.put('/profile', { ...PROFILE, nextInvoiceNumber: '042/2026' });
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const s = (
      await c.post('/sessions', {
        clientId: client.id, date: '2027-01-05', start: '09:00', end: '10:00', note: '',
      })
    ).body as { id: string };
    const inv = (
      await c.post('/invoices', {
        clientId: client.id,
        sessionIds: [s.id],
        issueDate: '2027-01-31',
        dueDate: '2027-02-14',
        description: '',
      })
    ).body as { number: string };
    assert.equal(inv.number, '001/2027');
  });

  it('gives concurrent invoices consecutive numbers, never the same one', async () => {
    const c = await signUp('race@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    const sessionIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const s = (
        await c.post('/sessions', {
          clientId: client.id,
          date: `2026-07-0${i + 1}`,
          start: '09:00',
          end: '10:00',
          note: '',
        })
      ).body as { id: string };
      sessionIds.push(s.id);
    }

    // Five invoices at once, each from its own hour.
    const results = await Promise.all(
      sessionIds.map((id) =>
        c.post('/invoices', {
          clientId: client.id,
          sessionIds: [id],
          issueDate: '2026-07-31',
          dueDate: '2026-08-14',
          description: '',
        }),
      ),
    );

    assert.ok(results.every((r) => r.status === 201), 'all five were issued');
    const numbers = results.map((r) => (r.body as { number: string }).number).sort();
    assert.equal(new Set(numbers).size, 5, `numbers were ${numbers.join(', ')}`);
  });

  it('refuses a duplicate number on import', async () => {
    const c = await signUp('import@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    const imported = {
      number: '001/2025',
      clientId: client.id,
      issueDate: '2025-03-01',
      dueDate: '2025-03-15',
      description: 'Storitve',
      periodStart: '2025-02-01',
      periodEnd: '2025-02-28',
      total: 1820,
      status: 'paid' as const,
      paidDate: '2025-03-10',
    };

    const first = await c.post('/invoices/import', imported);
    assert.equal(first.status, 201);
    assert.equal((first.body as { total: number }).total, 1820);

    const second = await c.post('/invoices/import', imported);
    assert.equal(second.status, 422);
    assert.match(String((second.body?.fields as { number: string }).number), /že obstaja/);
  });

  it('frees the hours again when an invoice is deleted', async () => {
    const c = await signUp('undo@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const s = (
      await c.post('/sessions', {
        clientId: client.id,
        date: '2026-08-03',
        start: '09:00',
        end: '17:00',
        note: '',
      })
    ).body as { id: string };
    const invoice = (
      await c.post('/invoices', {
        clientId: client.id,
        sessionIds: [s.id],
        issueDate: '2026-08-31',
        dueDate: '2026-09-14',
        description: '',
      })
    ).body as { id: string };

    assert.equal((await c.del(`/invoices/${invoice.id}`)).status, 204);
    const sessions = (await c.get('/sessions')).body as {
      invoiced: boolean;
      invoiceId: string | null;
    }[];
    assert.equal(sessions[0]?.invoiced, false);
    assert.equal(sessions[0]?.invoiceId, null);
  });

  it('refuses to rewrite the figures behind a generated invoice', async () => {
    const c = await signUp('edit@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const s = (
      await c.post('/sessions', {
        clientId: client.id,
        date: '2026-09-01',
        start: '09:00',
        end: '10:00',
        note: '',
      })
    ).body as { id: string };
    const invoice = (
      await c.post('/invoices', {
        clientId: client.id,
        sessionIds: [s.id],
        issueDate: '2026-09-30',
        dueDate: '2026-10-14',
        description: '',
      })
    ).body as { id: string };

    assert.equal((await c.patch(`/invoices/${invoice.id}`, { total: 1 })).status, 409);
    // Dates and description are still the issuer's to correct.
    const ok = await c.patch(`/invoices/${invoice.id}`, { description: 'Popravljeno' });
    assert.equal(ok.status, 200);
    assert.equal((ok.body as { description: string }).description, 'Popravljeno');
  });

  it('records payment and takes it back', async () => {
    const c = await signUp('paid@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const invoice = (
      await c.post('/invoices/import', {
        number: '007/2026',
        clientId: client.id,
        issueDate: '2026-04-01',
        dueDate: '2026-04-15',
        description: 'Storitve',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
        total: 500,
        status: 'unpaid',
        paidDate: null,
      })
    ).body as { id: string };

    const paid = await c.patch(`/invoices/${invoice.id}/payment`, {
      paid: true,
      paidDate: '2026-04-10',
    });
    assert.equal((paid.body as { status: string }).status, 'paid');
    assert.equal((paid.body as { paidDate: string }).paidDate, '2026-04-10');

    const back = await c.patch(`/invoices/${invoice.id}/payment`, {
      paid: false,
      paidDate: null,
    });
    assert.equal((back.body as { status: string }).status, 'unpaid');
    assert.equal((back.body as { paidDate: string | null }).paidDate, null);

    // A paid invoice without a date is not a state the ledger allows.
    const bad = await c.patch(`/invoices/${invoice.id}/payment`, {
      paid: true,
      paidDate: null,
    });
    assert.equal(bad.status, 422);
  });
});

describe('clients', () => {
  it('deactivates a client with history instead of deleting it', async () => {
    const c = await signUp('deactivate@example.com');
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    await c.post('/sessions', {
      clientId: client.id,
      date: '2026-05-06',
      start: '09:00',
      end: '13:30',
      note: '',
    });

    const res = await c.del(`/clients/${client.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body?.deactivated, true);

    const clients = (await c.get('/clients')).body as { isActive: boolean }[];
    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.isActive, false);

    // The hours it was worked for are untouched.
    assert.equal(((await c.get('/sessions')).body as unknown[]).length, 1);

    const back = await c.patch(`/clients/${client.id}/active`, { isActive: true });
    assert.equal((back.body as { isActive: boolean }).isActive, true);
  });

  it('deletes a client nothing points at', async () => {
    const c = await signUp('delete@example.com');
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const res = await c.del(`/clients/${client.id}`);
    assert.equal(res.body?.deactivated, false);
    assert.deepEqual((await c.get('/clients')).body, []);
  });

  it('validates on the server, not just in the browser', async () => {
    const c = await signUp('validate@example.com');
    const bad = await c.post('/clients', { ...CLIENT, taxNumber: '12345678', rate: 0 });
    assert.equal(bad.status, 422);
    const fields = bad.body?.fields as Record<string, string>;
    assert.ok(fields.taxNumber, 'the check digit is verified server-side');
    assert.ok(fields.rate, 'a rate of zero is refused');
  });
});

describe('backup and restore', () => {
  it('replaces the ledger and keeps the links inside the file', async () => {
    const c = await signUp('restore@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    await c.post('/sessions', {
      clientId: client.id,
      date: '2026-05-06',
      start: '09:00',
      end: '13:30',
      note: 'pred obnovo',
    });

    // A backup taken elsewhere, with its own ids.
    const restored = await c.post('/bootstrap/restore', {
      profile: { ...PROFILE, name: 'Obnovljeni s.p.' },
      clients: [{ ...CLIENT, id: 'old-client-1', name: 'Obnovljena stranka' }],
      sessions: [
        {
          id: 'old-session-1',
          clientId: 'old-client-1',
          date: '2026-02-02',
          start: '08:00',
          end: '12:00',
          note: 'iz kopije',
          invoiceId: 'old-invoice-1',
        },
      ],
      invoices: [
        {
          id: 'old-invoice-1',
          number: '002/2026',
          clientId: 'old-client-1',
          issueDate: '2026-02-28',
          dueDate: '2026-03-14',
          description: 'Storitve',
          periodStart: '2026-02-02',
          periodEnd: '2026-02-02',
          totalHours: 4,
          rate: 28,
          total: 112,
          status: 'unpaid',
          paidDate: null,
        },
      ],
    });

    assert.equal(restored.status, 200);
    const data = restored.body as Record<string, unknown>;
    assert.equal((data.profile as { name: string }).name, 'Obnovljeni s.p.');

    // What was there before is gone, not merged.
    const clients = data.clients as { id: string; name: string }[];
    const sessions = data.sessions as { note: string; invoiceId: string | null }[];
    const invoices = data.invoices as { id: string; sessionIds: string[] }[];
    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.name, 'Obnovljena stranka');
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.note, 'iz kopije');

    // The file's own ids were not reused, but its links survived.
    assert.notEqual(clients[0]?.id, 'old-client-1');
    assert.notEqual(invoices[0]?.id, 'old-invoice-1');
    assert.equal(sessions[0]?.invoiceId, invoices[0]?.id);
    assert.deepEqual(invoices[0]?.sessionIds, [(data.sessions as { id: string }[])[0]?.id]);
  });
});

describe('registry lookup', () => {
  it('tidies what a register shouts back', async () => {
    const { tidyRegistryName, tidyPlaceName, parseRegistryAddress } = await import(
      '@reckon/shared'
    );

    // Company names: title case, legal forms small, punctuation kept.
    assert.equal(tidyRegistryName('VIKRAM D.O.O.'), 'Vikram d.o.o.');
    assert.equal(tidyRegistryName('PETROL D.D., LJUBLJANA'), 'Petrol d.d., Ljubljana');
    // Already mixed case is somebody's spelling; leave it alone.
    assert.equal(tidyRegistryName('iSKRA d.o.o.'), 'iSKRA d.o.o.');

    // Places: sentence case per part, house-number letters large.
    assert.equal(tidyPlaceName('VOJKOVO NABREŽJE 31 A'), 'Vojkovo nabrežje 31 A');
    assert.equal(tidyPlaceName('DUNAJSKA CESTA 050, LJUBLJANA'), 'Dunajska cesta 050, Ljubljana');
    assert.equal(tidyPlaceName('KOPER - CAPODISTRIA'), 'Koper - Capodistria');
    assert.equal(tidyPlaceName('NOVO MESTO'), 'Novo mesto');

    const address = parseRegistryAddress('VOJKOVO NABREŽJE 31 A, 6000 KOPER - CAPODISTRIA');
    assert.deepEqual(address, {
      street: 'Vojkovo nabrežje 31 A',
      postalCode: '6000',
      city: 'Koper - Capodistria',
    });
  });

  it('checks the number before asking anyone about it', async () => {
    const c = await signUp('lookup@example.com');
    const bad = await c.get('/lookup/company?taxNumber=12345678');
    assert.equal(bad.status, 422, 'a wrong check digit never reaches the register');
    assert.ok((bad.body?.fields as { taxNumber: string }).taxNumber);

    assert.equal((await c.get('/lookup/company?taxNumber=')).status, 422);
  });

  it('needs a session, like everything else', async () => {
    const anon = new Client(base);
    assert.equal((await anon.get('/lookup/company?taxNumber=29825962')).status, 401);
  });
});

describe('identifiers', () => {
  it('addresses ids Postgres accepts, not only RFC-perfect ones', async () => {
    // The seed's hand-written ids have the wrong variant nibble for z.uuid(),
    // but Postgres stores them happily — so the API has to reach them.
    const c = await signUp('ids@example.com');
    const legacyShaped = '22222222-2222-2222-2222-222222222222';
    const res = await c.get(`/clients/${legacyShaped}`);
    assert.equal(res.status, 404, 'well-formed but absent → not found');
    assert.notEqual(res.status, 422, 'not rejected as malformed');
  });

  it('treats a malformed id as not found, not as a server fault', async () => {
    const c = await signUp('badid@example.com');
    for (const path of ['/clients/undefined', '/sessions/not-a-uuid', '/invoices/42']) {
      const res = await c.get(path);
      assert.equal(res.status, 404, path);
    }
    assert.equal((await c.del('/sessions/undefined')).status, 404);
  });
});

describe('rate limiting', () => {
  it('stops a password being guessed at machine speed', async () => {
    const express = (await import('express')).default;
    const { rateLimit } = await import('../src/middleware/rateLimit.js');
    const { errorHandler } = await import('../src/middleware/errorHandler.js');

    const app = express();
    app.post('/try', rateLimit({ windowMs: 60_000, max: 3, message: 'Preveč poskusov' }),
      (_req, res) => res.status(204).end());
    app.use(errorHandler);

    const srv = createServer(app);
    await new Promise<void>((resolve) => srv.listen(0, resolve));
    const origin = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/try`;

    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      codes.push((await fetch(origin, { method: 'POST' })).status);
    }
    await new Promise<void>((resolve) => srv.close(() => resolve()));

    assert.deepEqual(codes, [204, 204, 204, 429, 429]);
  });
});

describe('bootstrap', () => {
  it('returns the whole ledger in one request', async () => {
    const c = await signUp('bootstrap@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    await c.post('/sessions', {
      clientId: client.id,
      date: '2026-05-06',
      start: '09:00',
      end: '13:30',
      note: 'delo',
    });

    const res = await c.get('/bootstrap');
    assert.equal(res.status, 200);
    const data = res.body as Record<string, unknown>;
    assert.equal((data.profile as { name: string }).name, PROFILE.name);
    assert.equal((data.clients as unknown[]).length, 1);
    assert.equal((data.sessions as unknown[]).length, 1);
    assert.deepEqual(data.invoices, []);
    // Dates survive the round trip as calendar days, not shifted instants.
    assert.equal((data.sessions as { date: string }[])[0]?.date, '2026-05-06');
  });
});
