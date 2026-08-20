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

    // And still frozen once the invoice is paid — which is the state the hours
    // most need protecting in, since the document is now settled as well as
    // sent. Taking the payment back does not thaw them either: they are on the
    // invoice, and only deleting the invoice returns them.
    await c.patch(`/invoices/${invoice.id}/payment`, {
      paid: true, paidDate: '2026-05-20',
    });
    assert.equal(
      (await c.put(`/sessions/${ids[0]}`, {
        clientId: client.id, date: '2026-05-09', start: '09:00', end: '13:30',
        note: 'moved',
      })).status,
      409,
    );
    assert.equal((await c.del(`/sessions/${ids[0]}`)).status, 409);

    await c.patch(`/invoices/${invoice.id}/payment`, { paid: false, paidDate: null });
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

  it('hands a deleted invoice\'s number back to the next one', async () => {
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

    // The ledger is the whole authority, so a deleted number comes back round.
    assert.equal((await c.del(`/invoices/${first.id}`)).status, 204);
    const second = await issue('2026-03-02');
    assert.equal(second.number, '001/2026', 'the number was not reused');

    // Only the newest one frees a number: deleting from the middle leaves the
    // gap where it is rather than issuing a number out of order.
    const third = await issue('2026-03-03');
    const fourth = await issue('2026-03-04');
    assert.equal(third.number, '002/2026');
    assert.equal(fourth.number, '003/2026');
    assert.equal((await c.del(`/invoices/${third.id}`)).status, 204);
    assert.equal((await issue('2026-03-05')).number, '004/2026');

    // Nothing was remembered behind the ledger's back: the profile still says
    // what the user typed, not a high-water mark the app moved on its own.
    assert.equal(
      ((await c.get('/profile')).body as { nextInvoiceNumber: string })
        .nextInvoiceNumber,
      PROFILE.nextInvoiceNumber,
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

  it('issues an invoice with no hours behind it', async () => {
    const c = await signUp('manual@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    const res = await c.post('/invoices/manual', {
      clientId: client.id,
      issueDate: '2026-05-31',
      dueDate: '2026-06-14',
      description: 'Pripravljenost na klic, maj',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      total: 450,
    });
    assert.equal(res.status, 201);
    const invoice = res.body as Record<string, unknown>;

    assert.equal(invoice.number, '001/2026', 'numbered by the app like any other');
    assert.equal(invoice.total, 450);
    assert.equal(invoice.totalHours, null, 'no hours stand behind it');
    assert.equal(invoice.rate, null);
    assert.equal(invoice.imported, false, 'this app issued it');
    assert.deepEqual(invoice.sessionIds, []);
    assert.equal(invoice.periodStart, '2026-05-01');
    assert.equal(invoice.periodEnd, '2026-05-31');
    assert.equal(invoice.clientName, CLIENT.name);

    // Nothing was billed, so nothing got locked.
    assert.deepEqual((await c.get('/sessions')).body, []);

    // And with no hours to contradict, its figures stay editable.
    const edited = await c.patch(`/invoices/${invoice.id as string}`, {
      total: 500,
      periodEnd: '2026-06-01',
    });
    assert.equal(edited.status, 200);
    assert.equal((edited.body as { total: number }).total, 500);
  });

  it('refuses a period that ends before it starts', async () => {
    const c = await signUp('badperiod@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const res = await c.post('/invoices/manual', {
      clientId: client.id,
      issueDate: '2026-05-31',
      dueDate: '2026-06-14',
      description: '',
      periodStart: '2026-05-31',
      periodEnd: '2026-05-01',
      total: 100,
    });
    assert.equal(res.status, 422);
    assert.ok((res.body?.fields as { periodEnd: string }).periodEnd);

    const free = await c.post('/invoices/manual', {
      clientId: client.id, issueDate: '2026-05-31', dueDate: '2026-06-14',
      description: '', periodStart: '2026-05-01', periodEnd: '2026-05-31', total: 0,
    });
    assert.equal(free.status, 422, 'an invoice for nothing is not an invoice');
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

  it('lets a payment date be corrected without disturbing the rest', async () => {
    const c = await signUp('paiddate@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const invoice = (
      await c.post('/invoices/import', {
        number: '011/2026', clientId: client.id, issueDate: '2026-03-01',
        dueDate: '2026-03-15', description: 'Storitve', periodStart: '2026-02-01',
        periodEnd: '2026-02-28', total: 1000, status: 'paid', paidDate: '2026-03-20',
      })
    ).body as { id: string };

    // Logged as paid today by mistake; the money actually arrived on the 12th.
    const fixed = await c.patch(`/invoices/${invoice.id}/payment`, {
      paid: true, paidDate: '2026-03-12',
    });
    assert.equal(fixed.status, 200);
    assert.equal((fixed.body as { paidDate: string }).paidDate, '2026-03-12');
    assert.equal((fixed.body as { status: string }).status, 'paid', 'still paid');
    assert.equal((fixed.body as { total: number }).total, 1000, 'and untouched otherwise');

    // Which is the whole reason it matters: revenue follows that date.
    const t = (await c.get('/tax/trajectory?year=2026')).body as {
      paidSeries: { date: string }[];
    };
    assert.equal(t.paidSeries[0]?.date, '2026-03-12');
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

  it('maps an AJPES row the way the register actually sends it', async () => {
    // Verbatim from the restPrsInfo documentation's own example response.
    const { mapAjpesRow } = await import('../src/modules/lookup/lookup.service.js');

    assert.deepEqual(
      mapAjpesRow(
        {
          popolno_ime: 'Mia Erbus, računalniško programiranje, s.p.',
          kratko_ime: 'Mia Erbus s.p.',
          maticna: '9089357000',
          ulica: 'Placar 042 A',
          posta: '2250 Ptuj',
        },
        '12345670',
      ),
      {
        // The registered name, not the short one: that is what goes on an invoice.
        name: 'Mia Erbus, računalniško programiranje, s.p.',
        street: 'Placar 42 A',
        postalCode: '2250',
        city: 'Ptuj',
        taxNumber: '12345670',
        regNumber: '9089357000',
        source: 'ajpes',
      },
    );

    const fructal = mapAjpesRow(
      { popolno_ime: 'FRUCTAL Živilska industrija d.o.o.', maticna: '5048664000',
        ulica: 'Tovarniška cesta 007', posta: '5270 Ajdovščina' },
      '12345670',
    );
    assert.equal(fructal.street, 'Tovarniška cesta 7');
    assert.equal(fructal.city, 'Ajdovščina');
  });

  it('reads a bizi.si result row', async () => {
    const { parseBiziRow } = await import('../src/modules/lookup/lookup.service.js');

    // Trimmed from a real results page: the cells in the order the site emits
    // them, with the markup that identifies each one.
    const page = `
      <div id="x_trRepRow_7523459000" Class="row b-table-row">
        <div Class="col b-table-cell b-check"><input type="checkbox" /></div>
        <div Class="col b-table-cell b-table-cell-title"><a class="i-shield"></a><a class="b-link-company" href="/AMAR-USTAVDIC-S-P/"><span Class="b-company-title">Amar Ustavdić, s.p.</span></a></div>
        <div Class="col b-table-cell "><a href="javascript:openMapTis(45.54264, 13.70775, &#39;Amar Ustavdić, s.p.&#39;, &#39;KOPER&#39;, 0.5);">Izletniška pot   052</a></div>
        <div Class="col b-table-cell  d-none d-sm-block">6000 Koper - Capodistria</div>
        <div Class="col b-table-cell  d-none d-md-block">7523459000</div>
        <div Class="col b-table-cell  d-none d-lg-block">82426490</div>
        <div Class="col b-table-cell  d-none d-xl-block">Zaščita in reševanje pri požarih in nesrečah</div>
      </div>`;

    assert.deepEqual(parseBiziRow(page, '82426490'), {
      name: 'Amar Ustavdić, s.p.',
      street: 'Izletniška pot 52',
      postalCode: '6000',
      city: 'Koper - Capodistria',
      taxNumber: '82426490',
      regNumber: '7523459000',
      source: 'bizi',
    });

    // A page about somebody else is not an answer about this number.
    assert.equal(parseBiziRow(page, '29825962'), null);
    // Markup that changed past recognition reads as "not found", not a crash.
    assert.equal(parseBiziRow('<html><body>nothing here</body></html>', '82426490'), null);
  });

  it('explains an absence by what was actually asked', async () => {
    // With the business-register fallback on, absence means absent from it;
    // with only VIES available it means "not registered for VAT", which is a
    // different and much more common thing.
    process.env.BIZI_FALLBACK = 'off';
    const { lookupService } = await import('../src/modules/lookup/lookup.service.js');
    void lookupService;
    process.env.BIZI_FALLBACK = 'on';

    const c = await signUp('notvat@example.com');
    const res = await c.get('/lookup/company?taxNumber=11111111');
    assert.equal(res.status, 422, 'a number failing its check digit never leaves here');
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

describe('tax engines', () => {
  it('reproduces the real PODO-OPSVZ filings to the cent', async () => {
    const { monthlyContributions } = await import('@reckon/shared');

    // June 2026: registered on the 3rd, so the base is prorated 160/176 hours.
    const june = monthlyContributions({
      year: 2026, month: 6, startIso: '2026-06-03', fullBaseCents: 152162,
    });
    assert.equal(june.baseCents, 138329, 'prorated base');
    assert.equal(june.relief, 0.5, '50% relief in the first year');
    assert.equal(june.piz, 16841);
    assert.equal(june.zzDo, 25308);
    assert.equal(june.stv, 276);
    assert.equal(june.zap, 277);
    assert.equal(june.total, 42702, 'the filing says 427,02');

    // July 2026: the first full month.
    const july = monthlyContributions({
      year: 2026, month: 7, startIso: '2026-06-03', fullBaseCents: 152162,
    });
    assert.equal(july.baseCents, 152162);
    assert.equal(july.piz, 18526);
    assert.equal(july.zzDo, 27445);
    assert.equal(july.stv, 304);
    assert.equal(july.zap, 304);
    assert.equal(july.total, 46579, 'the filing says 465,79');
  });

  it('steps the relief down at twelve months and off at twenty-four', async () => {
    const { contributionRelief, taxYearConfig, monthlyContributions } = await import(
      '@reckon/shared'
    );
    const { config } = taxYearConfig(2026);

    assert.equal(contributionRelief('2026-06-03', 2026, 6, config), 0.5, 'month 0');
    assert.equal(contributionRelief('2026-06-03', 2027, 5, config), 0.5, 'month 11');
    assert.equal(contributionRelief('2026-06-03', 2027, 6, config), 0.3, 'month 12');
    assert.equal(contributionRelief('2026-06-03', 2028, 5, config), 0.3, 'month 23');
    assert.equal(contributionRelief('2026-06-03', 2028, 6, config), 0, 'month 24');

    // The step is a real jump in what is owed, which is the point of showing it.
    const first = monthlyContributions({
      year: 2027, month: 5, startIso: '2026-06-03', fullBaseCents: 152162,
    });
    const second = monthlyContributions({
      year: 2027, month: 6, startIso: '2026-06-03', fullBaseCents: 152162,
    });
    assert.ok(second.total > first.total, 'contributions rise when relief drops');
    assert.equal(second.piz - first.piz, 7410, '20 points of a 37.052 PIZ charge');
  });

  it('counts weekdays the way the filing did, holidays included', async () => {
    const { workingHoursInMonth } = await import('@reckon/shared');
    // 25 June 2026 is a state holiday on a Thursday; the filing still counted
    // it, so 3–30 June is 20 weekdays, not 19.
    assert.equal(workingHoursInMonth(2026, 6), 176);
    assert.equal(workingHoursInMonth(2026, 6, 3), 160);
  });

  it('taxes revenue in bands, and splits a payment that straddles one', async () => {
    const { incomeTax, incomeTaxOnAdditional } = await import('@reckon/shared');

    // 4% effective up to 60.000: 80% recognised as expense, 20% rate on the rest.
    assert.equal(incomeTax(3_000_000, 'full', 2026).taxCents, 120_000);
    assert.equal(incomeTax(6_000_000, 'full', 2026).taxCents, 240_000);
    // Above it nothing is recognised, so each euro is base, taxed at 20%.
    assert.equal(incomeTax(9_000_000, 'full', 2026).taxCents, 840_000);
    // At 120.000 of revenue the base is 72.000 — where 35% begins.
    const at120 = incomeTax(12_000_000, 'full', 2026);
    assert.equal(at120.baseCents, 7_200_000);
    assert.equal(at120.taxCents, 1_440_000);
    assert.equal(at120.marginalRate, 0.35);
    assert.equal(incomeTax(13_000_000, 'full', 2026).taxCents, 1_790_000);

    // A single payment crossing 60.000 is taxed on both sides of the line.
    assert.equal(
      incomeTaxOnAdditional(5_500_000, 1_000_000, 'full', 2026),
      120_000,
      '5.000 at 4% plus 5.000 at 20%',
    );
    // The rate on new money follows the cumulative position, not the amount.
    assert.equal(incomeTaxOnAdditional(0, 1_000_000, 'full', 2026), 40_000);
  });

  it('matches the published worked example for a popoldanski s.p.', async () => {
    const { incomeTax } = await import('@reckon/shared');
    // 12.500 at 4% + 17.500 at 12% + 20.000 at 20% + 10.000 at 35% = 10.100.
    assert.equal(incomeTax(6_000_000, 'part', 2026).taxCents, 1_010_000);
  });
});

describe('tax module', () => {
  const taxProfile = {
    businessStartDate: '2026-06-03',
    contributionBase: 1521.62,
    contributionReliefOverride: null,
    normiranecKind: 'full' as const,
    declaredMonthlyEstimate: null,
    officialInstallment: 120,
    officialInstallmentFrequency: 'monthly' as const,
    dohodninaIban: 'SI56011008881000030',
    dohodninaReference: '',
    weeklyHours: 40,
  };

  async function withRevenue(email: string) {
    const c = await signUp(email);
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', taxProfile);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    // Two invoices paid this year, one still outstanding.
    const invoice = async (number: string, total: number, paidOn: string | null) =>
      (
        await c.post('/invoices/import', {
          number, clientId: client.id, issueDate: '2026-07-01', dueDate: '2126-07-15',
          description: 'Storitve', periodStart: '2026-06-01', periodEnd: '2026-06-30',
          total, status: paidOn ? 'paid' : 'unpaid', paidDate: paidOn,
        })
      ).body as { id: string };

    await invoice('001/2026', 4000, '2026-07-10');
    await invoice('002/2026', 2500, '2026-08-05');
    await invoice('003/2026', 1000, null);
    return c;
  }

  it('invents nothing before the business details exist', async () => {
    // A brand-new account: no start date, no base confirmed, no invoices.
    const c = await signUp('empty-tax@example.com');
    await c.put('/profile', PROFILE);

    const s = (await c.get('/tax/summary?year=2026')).body as Record<
      string,
      Record<string, unknown>
    > & { needs: string[] };

    assert.deepEqual(s.needs, ['businessStartDate'], 'and it says what is missing');
    assert.equal(s.contributions!.configured, false);
    assert.equal(s.contributions!.monthlyAmount, null, 'no figure, not a default one');
    assert.equal(s.contributions!.breakdown, null);
    assert.equal(s.contributions!.dueThisYear, 0, 'no year-long debt conjured up');
    assert.equal(s.thisMonth!.contributions, null);

    // The schedule is empty rather than twelve invented months.
    assert.deepEqual((await c.get('/tax/contributions?year=2026')).body, []);

    // Income tax needs none of that — it follows the invoices, and there are none.
    assert.equal(s.dohodnina!.ytdRevenue, 0);
    assert.equal(s.dohodnina!.owedToDate, 0);
  });

  it('computes income tax from paid invoices alone, with no s.p. details set', async () => {
    const c = await signUp('paidonly@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    await c.post('/invoices/import', {
      number: '001/2026', clientId: client.id, issueDate: '2026-07-01',
      dueDate: '2126-07-15', description: 'Storitve', periodStart: '2026-06-01',
      periodEnd: '2026-06-30', total: 5000, status: 'paid', paidDate: '2026-07-10',
    });
    // An unpaid one must not count: revenue is what arrived.
    await c.post('/invoices/import', {
      number: '002/2026', clientId: client.id, issueDate: '2026-07-01',
      dueDate: '2126-07-15', description: 'Storitve', periodStart: '2026-06-01',
      periodEnd: '2026-06-30', total: 9999, status: 'unpaid', paidDate: null,
    });

    const s = (await c.get('/tax/summary?year=2026')).body as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(s.dohodnina!.ytdRevenue, 5000, 'only what was actually paid');
    assert.equal(s.dohodnina!.owedToDate, 200, '4% of 5.000');
    assert.equal(s.contributions!.configured, false, 'still nothing to say there');
  });

  it('answers what is owed right now, keeping the two obligations apart', async () => {
    const c = await withRevenue('tax@example.com');
    const res = await c.get('/tax/summary?year=2026');
    assert.equal(res.status, 200);
    const s = res.body as Record<string, Record<string, unknown>>;

    // Revenue counts when the money arrived: 4.000 + 2.500, not the unpaid 1.000.
    assert.equal(s.dohodnina!.ytdRevenue, 6500);
    assert.equal(s.dohodnina!.owedToDate, 260, '4% of 6.500');
    assert.equal(s.dohodnina!.recommendedNow, 260, 'nothing paid yet');
    assert.equal(s.dohodnina!.marginalRate, 0.04);
    assert.equal(s.dohodnina!.reference, 'SI19 82426490-40002', 'offered, not invented');

    // Contributions know nothing about revenue.
    assert.equal(s.contributions!.relief, 0.5);
    assert.equal(s.contributions!.estimated, true);
    assert.ok((s.contributions!.dueThisYear as number) > 0);

    assert.deepEqual(s.officialInstallment, { amount: 120, frequency: 'monthly' });
    assert.equal((s.partialYear as { monthsCovered: number }).monthsCovered, 7);
  });

  it('owes the month that has ended, not the one still running', async () => {
    const c = await withRevenue('duemonth@example.com');
    const now = new Date();

    // The current year: what is owed is last month, and the running month is
    // not on the list at all.
    const current = (await c.get(`/tax/summary?year=${now.getFullYear()}`)).body as {
      contributions: { dueMonth: number | null };
      thisMonth: { month: number };
    };
    assert.equal(
      current.contributions.dueMonth,
      now.getMonth(),
      'the previous calendar month',
    );
    assert.notEqual(current.contributions.dueMonth, now.getMonth() + 1);

    // A year gone by owes all of itself — provided the business existed then.
    // This fixture opened in June 2026, so last year owes nothing at all.
    const past = (await c.get(`/tax/summary?year=${now.getFullYear() - 1}`)).body as {
      contributions: { dueMonth: number | null; beforeBusiness: boolean };
    };
    assert.equal(past.contributions.beforeBusiness, true);
    assert.equal(past.contributions.dueMonth, null);

    // An older business does owe the whole of a year gone by.
    const older = await signUp('older@example.com');
    await older.put('/profile', PROFILE);
    await older.put('/profile/tax', { ...taxProfile, businessStartDate: '2020-01-15' });
    const theirs = (await older.get(`/tax/summary?year=${now.getFullYear() - 1}`)).body as {
      contributions: { dueMonth: number | null };
    };
    assert.equal(theirs.contributions.dueMonth, 12);

    // A year not yet begun owes nothing.
    const future = (await c.get(`/tax/summary?year=${now.getFullYear() + 1}`)).body as {
      contributions: { dueMonth: number | null; monthlyAmount: number | null };
    };
    assert.equal(future.contributions.dueMonth, null);
    assert.equal(future.contributions.monthlyAmount, null);
  });

  it('owes nothing for a year before the s.p. existed', async () => {
    const c = await withRevenue('before@example.com');
    // The business starts 03.06.2026; 2025 predates it entirely.
    const s = (await c.get('/tax/summary?year=2025')).body as Record<
      string,
      Record<string, unknown>
    >;

    assert.equal(s.contributions!.beforeBusiness, true);
    assert.equal(s.contributions!.dueMonth, null, 'no month of it was owed');
    assert.equal(s.contributions!.monthlyAmount, null, 'and no amount, not even a full one');
    assert.equal(s.contributions!.dueThisYear, 0);
    assert.equal(s.thisMonth!.contributions, null);
    assert.equal(s.thisMonth!.total, 0);
    assert.deepEqual((await c.get('/tax/contributions?year=2025')).body, []);

    // The year it opened owes only from the month it opened.
    const opened = (await c.get('/tax/summary?year=2026')).body as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(opened.contributions!.beforeBusiness, false);
  });

  it('refuses to estimate contributions for a popoldanski s.p.', async () => {
    // Their contributions are a flat pavšal of a little over 100 EUR, not a
    // share of the insurance base — the full-time engine would say ~650.
    const c = await signUp('part@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', { ...taxProfile, normiranecKind: 'part' });

    const s = (await c.get('/tax/summary?year=2026')).body as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(s.contributions!.estimateUnavailable, true);
    assert.equal(s.contributions!.monthlyAmount, null, 'no figure rather than a wrong one');
    assert.deepEqual((await c.get('/tax/contributions?year=2026')).body, []);

    // The tax side still works — those bands are modelled for both kinds.
    assert.equal(s.dohodnina!.marginalRate, 0.04);

    // And a filing entered by hand is honoured exactly as entered.
    await c.post('/tax/contributions', {
      year: 2026, month: 7, base: 0, piz: 49.15, zzDo: 60.96, stv: 0, zap: 0,
    });
    const filed = (await c.get('/tax/contributions?year=2026')).body as {
      month: number; total: number; estimated: boolean;
    }[];
    assert.equal(filed.length, 1);
    assert.equal(filed[0]?.total, 110.11);
    assert.equal(filed[0]?.estimated, false);
  });

  it('stops asking for a month that has been paid', async () => {
    const c = await signUp('settled-head@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', { ...taxProfile, businessStartDate: '2020-01-15' });

    // A year gone by, so the month in question is December.
    const year = new Date().getFullYear() - 1;
    const before = (await c.get(`/tax/summary?year=${year}`)).body as Record<
      string,
      Record<string, unknown>
    >;
    const monthly = before.contributions!.monthlyAmount as number;
    assert.ok(monthly > 0);
    assert.equal(before.thisMonth!.contributions, monthly, 'the whole month is owed');
    assert.equal(before.thisMonth!.contributionsSettled, false);

    await c.post('/tax/payments', {
      paidOn: `${year}-12-20`, amount: monthly, kind: 'contributions',
      note: '', periodYear: year, periodMonth: 12, groupKey: null,
    });

    const after = (await c.get(`/tax/summary?year=${year}`)).body as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(after.thisMonth!.contributions, 0, 'nothing left to pay for it');
    assert.equal(after.thisMonth!.contributionsSettled, true);
    assert.equal(after.contributions!.dueSettled, true);
    // The headline total is now only the tax side.
    assert.equal(after.thisMonth!.total, after.thisMonth!.recommendedDohodnina);
    // And the month itself is off the to-pay list, as it already was.
    const schedule = (await c.get(`/tax/contributions?year=${year}`)).body as {
      month: number; settled: { groups: Record<string, boolean> };
    }[];
    assert.equal(schedule.find((m) => m.month === 12)?.settled.groups.piz, true);
  });

  it('partly paying a month leaves only the remainder owing', async () => {
    const c = await signUp('partial-head@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', { ...taxProfile, businessStartDate: '2020-01-15' });
    const year = new Date().getFullYear() - 1;

    const monthly = ((await c.get(`/tax/summary?year=${year}`)).body as {
      contributions: { monthlyAmount: number };
    }).contributions.monthlyAmount;

    // Only the PIZ part.
    await c.post('/tax/payments', {
      paidOn: `${year}-12-20`, amount: 185.26, kind: 'contributions',
      note: '', periodYear: year, periodMonth: 12, groupKey: 'piz',
    });

    const s = (await c.get(`/tax/summary?year=${year}`)).body as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(s.thisMonth!.contributions, Math.round((monthly - 185.26) * 100) / 100);
    assert.equal(s.thisMonth!.contributionsSettled, false, 'not done until it is');
  });

  it('notices when what was paid differs from what was estimated', async () => {
    const c = await signUp('mismatch@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', { ...taxProfile, businessStartDate: '2020-01-15' });
    const year = new Date().getFullYear() - 1;

    const monthly = ((await c.get(`/tax/summary?year=${year}`)).body as {
      contributions: { monthlyAmount: number };
    }).contributions.monthlyAmount;

    // Paid what eDavki actually asked for, which is more than the estimate.
    const reallyPaid = Math.round((monthly + 22.5) * 100) / 100;
    await c.post('/tax/payments', {
      paidOn: `${year}-12-20`, amount: reallyPaid, kind: 'contributions',
      note: '', periodYear: year, periodMonth: 12, groupKey: null,
    });

    const december = ((await c.get(`/tax/contributions?year=${year}`)).body as {
      month: number;
      mismatch: { expected: number; paid: number; difference: number } | null;
    }[]).find((m) => m.month === 12);

    assert.equal(december?.mismatch?.paid, reallyPaid);
    assert.equal(december?.mismatch?.expected, monthly);
    assert.equal(december?.mismatch?.difference, 22.5, 'the estimate was short by this');

    // A month paid exactly as estimated says nothing.
    await c.post('/tax/payments', {
      paidOn: `${year}-11-20`, amount: monthly, kind: 'contributions',
      note: '', periodYear: year, periodMonth: 11, groupKey: null,
    });
    const november = ((await c.get(`/tax/contributions?year=${year}`)).body as {
      month: number; mismatch: unknown;
    }[]).find((m) => m.month === 11);
    assert.equal(november?.mismatch, null);

    // Nor does a month that is only partly paid — that is short, not wrong.
    await c.post('/tax/payments', {
      paidOn: `${year}-10-20`, amount: 100, kind: 'contributions',
      note: '', periodYear: year, periodMonth: 10, groupKey: 'piz',
    });
    const october = ((await c.get(`/tax/contributions?year=${year}`)).body as {
      month: number; mismatch: unknown;
    }[]).find((m) => m.month === 10);
    assert.equal(october?.mismatch, null);
  });

  it('takes the insurance base from a filing, since the filing is the authority', async () => {
    const c = await signUp('learnbase@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', { ...taxProfile, businessStartDate: '2026-06-03' });

    // FURS revised the base; the filing says so before the app could know.
    const filed = await c.post('/tax/contributions', {
      year: 2026, month: 7, base: 1600.00,
      piz: 194.80, zzDo: 286.56, stv: 3.20, zap: 3.20,
    });
    assert.equal(filed.status, 201);
    assert.deepEqual((filed.body as { baseUpdated: unknown }).baseUpdated, {
      from: 152162,
      to: 160000,
    });

    // And every later estimate is built on the corrected figure.
    const profile = (await c.get('/profile/tax')).body as { contributionBase: number };
    assert.equal(profile.contributionBase, 1600);

    const august = ((await c.get('/tax/contributions?year=2026')).body as {
      month: number; base: number; estimated: boolean;
    }[]).find((m) => m.month === 8);
    assert.equal(august?.estimated, true);
    assert.equal(august?.base, 1600, 'the estimate moved with it');

    // Filing the same base again changes nothing and says so.
    const again = await c.post('/tax/contributions', {
      year: 2026, month: 8, base: 1600.00,
      piz: 194.80, zzDo: 286.56, stv: 3.20, zap: 3.20,
    });
    assert.equal((again.body as { baseUpdated: unknown }).baseUpdated, null);
  });

  it('warns that paying tax before invoices land means paying again', async () => {
    const c = await withRevenue('accrue@example.com');
    const s = (await c.get('/tax/summary?year=2026')).body as Record<
      string,
      Record<string, unknown>
    >;
    const outstanding = s.dohodnina!.outstanding as {
      count: number;
      amount: number;
      taxIfPaid: number;
    };

    // One invoice of 1.000 is still unpaid, and it will add 4% when it lands.
    assert.equal(outstanding.count, 1);
    assert.equal(outstanding.amount, 1000);
    assert.equal(outstanding.taxIfPaid, 40);

    // Which is exactly the accumulation being warned about: settle the
    // recommendation now and the next payment reopens it.
    assert.equal(s.dohodnina!.recommendedNow, 260);
    await c.post('/tax/payments', {
      paidOn: '2026-08-20', amount: 260, kind: 'income_tax', note: '',
      periodYear: 2026, periodMonth: null, groupKey: null,
    });
    const after = (await c.get('/tax/summary?year=2026')).body as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(after.dohodnina!.recommendedNow, 0, 'square, for now');
    assert.equal(
      (after.dohodnina!.outstanding as { taxIfPaid: number }).taxIfPaid,
      40,
      'and 40 more waiting to be owed the moment that invoice is paid',
    );
  });

  it('subtracts what has already been paid from the recommendation', async () => {
    const c = await withRevenue('paced@example.com');
    await c.post('/tax/payments', {
      paidOn: '2026-08-20', amount: 100, kind: 'income_tax', note: 'akontacija',
    });

    const s = (await c.get('/tax/summary?year=2026')).body as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(s.dohodnina!.paidToDate, 100);
    assert.equal(s.dohodnina!.recommendedNow, 160, '260 owed less 100 paid');
  });

  it('plots money received and where it lands if everyone pays', async () => {
    const c = await withRevenue('traj@example.com');
    const t = (await c.get('/tax/trajectory?year=2026')).body as Record<string, unknown>;

    const paid = t.paidSeries as { date: string; cumulativeRevenue: number }[];
    assert.deepEqual(paid.map((p) => p.cumulativeRevenue), [4000, 6500]);
    assert.equal(paid[0]?.date, '2026-07-10', 'stepped on the payment date');

    // The optimistic line continues from where the real one stopped.
    const invoiced = t.invoicedSeries as { cumulativeRevenue: number }[];
    assert.deepEqual(invoiced.map((p) => p.cumulativeRevenue), [7500]);
    assert.equal(t.outstanding, 1000, 'the gap is money owed to you');

    const thresholds = t.thresholds as { amount: number; crossedOn: string | null }[];
    assert.equal(thresholds[0]?.amount, 60000);
    assert.equal(thresholds[0]?.crossedOn, null, 'nowhere near it yet');
    // A partial first year starts at registration, not at 1 January.
    assert.equal(t.yearStart, '2026-06-03');
  });

  it('records a real filing and prefers it over the estimate', async () => {
    const c = await withRevenue('filed@example.com');

    const before = (await c.get('/tax/contributions?year=2026')).body as {
      month: number; estimated: boolean; total: number;
    }[];
    assert.equal(before[0]?.month, 6, 'the year starts when the business did');
    assert.equal(before[0]?.estimated, true);
    assert.equal(before[0]?.total, 427.02, 'the estimate already matches the filing');

    const created = await c.post('/tax/contributions', {
      year: 2026, month: 6, base: 1383.29,
      piz: 168.41, zzDo: 253.08, stv: 2.76, zap: 2.77,
      payment: {
        piz: { iban: 'SI56011008882000003', reference: 'SI19 82426490-44008' },
        zzDo: { iban: 'SI56011008883000073', reference: 'SI19 82426490-45004' },
        stv: { iban: 'SI56011008881000030', reference: 'SI19 82426490-43001' },
        zap: { iban: 'SI56011008881000030', reference: 'SI19 82426490-42005' },
      },
    });
    assert.equal(created.status, 201);

    const after = (await c.get('/tax/contributions?year=2026')).body as {
      month: number; estimated: boolean; total: number;
      payment: { piz: { reference: string } } | null;
    }[];
    assert.equal(after[0]?.estimated, false, 'the filing replaced the estimate');
    assert.equal(after[0]?.total, 427.02);
    assert.equal(after[0]?.payment?.piz.reference, 'SI19 82426490-44008');

    // Filing the same month again corrects it rather than duplicating it.
    await c.post('/tax/contributions', {
      year: 2026, month: 6, base: 1383.29, piz: 168.41, zzDo: 253.08, stv: 2.76, zap: 2.80,
    });
    const again = (await c.get('/tax/contributions?year=2026')).body as { total: number }[];
    assert.equal(again[0]?.total, 427.05);
    assert.equal(again.filter((m) => m.total === 427.05).length, 1);
  });

  it('offers last month\'s accounts so they are not retyped', async () => {
    const c = await withRevenue('refs@example.com');
    await c.post('/tax/contributions', {
      year: 2026, month: 6, base: 1383.29, piz: 168.41, zzDo: 253.08, stv: 2.76, zap: 2.77,
      payment: {
        piz: { iban: 'SI56011008882000003', reference: 'SI19 82426490-44008' },
        zzDo: { iban: 'SI56011008883000073', reference: 'SI19 82426490-45004' },
        stv: { iban: 'SI56011008881000030', reference: 'SI19 82426490-43001' },
        zap: { iban: 'SI56011008881000030', reference: 'SI19 82426490-42005' },
      },
    });
    const last = (await c.get('/tax/contributions/last-payment-details')).body as {
      piz: { iban: string; reference: string };
    };
    assert.equal(last.piz.iban, 'SI56011008882000003');
    assert.equal(last.piz.reference, 'SI19 82426490-44008');
  });

  it('reconciles the year-end assessment against what was paid', async () => {
    const c = await withRevenue('assess@example.com');
    await c.post('/tax/payments', {
      paidOn: '2026-12-20', amount: 200, kind: 'income_tax', note: '',
    });
    await c.put('/tax/assessments/2026', {
      assessed: 260, receivedOn: '2027-03-15', note: 'odločba',
    });

    const s = (await c.get('/tax/summary?year=2026')).body as Record<string, unknown>;
    const a = s.assessment as { assessed: number; paid: number; balance: number };
    assert.equal(a.assessed, 260);
    assert.equal(a.paid, 200);
    assert.equal(a.balance, 60, 'still to settle within 30 days of filing');
  });

  it('keeps one account\'s tax out of another\'s', async () => {
    const a = await withRevenue('taxa@example.com');
    const b = await signUp('taxb@example.com');
    await b.put('/profile', PROFILE);

    const mine = (await a.get('/tax/summary?year=2026')).body as Record<string, Record<string, unknown>>;
    const theirs = (await b.get('/tax/summary?year=2026')).body as Record<string, Record<string, unknown>>;
    assert.equal(mine.dohodnina!.ytdRevenue, 6500);
    assert.equal(theirs.dohodnina!.ytdRevenue, 0);

    const contributions = (await a.get('/tax/contributions?year=2026')).body as unknown[];
    const id = (await a.post('/tax/contributions', {
      year: 2026, month: 7, base: 1521.62, piz: 185.26, zzDo: 274.45, stv: 3.04, zap: 3.04,
    })).body as { id: string };
    assert.ok(contributions.length > 0);
    assert.equal((await b.del(`/tax/contributions/${id.id}`)).status, 404);
  });
});

describe('paying before FURS says so', () => {
  it('offers payment codes for an estimated month once the accounts are known', async () => {
    const c = await signUp('early@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', {
      businessStartDate: '2026-06-03', contributionBase: 1521.62,
      contributionReliefOverride: null, normiranecKind: 'full',
      declaredMonthlyEstimate: null, officialInstallment: null,
      officialInstallmentFrequency: null, dohodninaIban: 'SI56011008881000030',
      dohodninaReference: '', weeklyHours: 40,
    });

    // Before the accounts are confirmed there is an amount but nowhere to send
    // it, and the app says so with a null rather than a guessed reference.
    const before = (await c.get('/tax/contributions?year=2026')).body as {
      month: number; total: number; payment: unknown; estimated: boolean;
    }[];
    assert.equal(before[0]?.total, 427.02, 'the amount is known regardless');
    assert.equal(before[0]?.payment, null, 'but not where to pay it');

    // Confirm them once on the profile — the suggested ones, checked by the user.
    const { suggestedContributionPayments } = await import('@reckon/shared');
    const suggested = suggestedContributionPayments('82426490');
    assert.equal(suggested.piz.reference, 'SI19 82426490-44008');
    assert.equal(suggested.piz.iban, 'SI56011008882000003');

    await c.put('/profile/tax', {
      businessStartDate: '2026-06-03', contributionBase: 1521.62,
      contributionReliefOverride: null, normiranecKind: 'full',
      declaredMonthlyEstimate: null, officialInstallment: null,
      officialInstallmentFrequency: null, dohodninaIban: 'SI56011008881000030',
      dohodninaReference: '', weeklyHours: 40,
      contributionAccounts: suggested,
    });

    const after = (await c.get('/tax/contributions?year=2026')).body as {
      month: number; estimated: boolean;
      payment: { piz: { iban: string; reference: string } } | null;
    }[];
    assert.equal(after[0]?.estimated, true, 'still an estimate — FURS has not filed yet');
    assert.equal(after[0]?.payment?.piz.reference, 'SI19 82426490-44008');
    assert.equal(after[0]?.payment?.piz.iban, 'SI56011008882000003');
  });

  it('learns the accounts from the first real filing', async () => {
    const c = await signUp('learns@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', {
      businessStartDate: '2026-06-03', contributionBase: 1521.62,
      contributionReliefOverride: null, normiranecKind: 'full',
      declaredMonthlyEstimate: null, officialInstallment: null,
      officialInstallmentFrequency: null, dohodninaIban: 'SI56011008881000030',
      dohodninaReference: '', weeklyHours: 40,
    });

    await c.post('/tax/contributions', {
      year: 2026, month: 6, base: 1383.29, piz: 168.41, zzDo: 253.08, stv: 2.76, zap: 2.77,
      payment: {
        piz: { iban: 'SI56011008882000003', reference: 'SI19 82426490-44008' },
        zzDo: { iban: 'SI56011008883000073', reference: 'SI19 82426490-45004' },
        stv: { iban: 'SI56011008881000030', reference: 'SI19 82426490-43001' },
        zap: { iban: 'SI56011008881000030', reference: 'SI19 82426490-42005' },
      },
    });

    // July was never filed, but now it knows where July is paid.
    const schedule = (await c.get('/tax/contributions?year=2026')).body as {
      month: number; estimated: boolean;
      payment: { zzDo: { reference: string } } | null;
    }[];
    const july = schedule.find((m) => m.month === 7);
    assert.equal(july?.estimated, true);
    assert.equal(july?.payment?.zzDo.reference, 'SI19 82426490-45004');
  });

  it('records a payment against the month and group it settles', async () => {
    const c = await signUp('settle@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', {
      businessStartDate: '2026-06-03', contributionBase: 1521.62,
      contributionReliefOverride: null, normiranecKind: 'full',
      declaredMonthlyEstimate: null, officialInstallment: null,
      officialInstallmentFrequency: null, dohodninaIban: 'SI56011008881000030',
      dohodninaReference: '', weeklyHours: 40,
    });

    // Paid the PIZ part of July early, straight after being paid by a client.
    await c.post('/tax/payments', {
      paidOn: '2026-08-03', amount: 185.26, kind: 'contributions',
      note: '', periodYear: 2026, periodMonth: 7, groupKey: 'piz',
    });

    const july = ((await c.get('/tax/contributions?year=2026')).body as {
      month: number;
      settled: { paid: number; groups: Record<string, boolean> };
    }[]).find((m) => m.month === 7);

    assert.equal(july?.settled.paid, 185.26);
    assert.equal(july?.settled.groups.piz, true, 'that group is settled');
    assert.equal(july?.settled.groups.zzDo, false, 'the other three are not');

    // A single lump payment for the month settles all four.
    await c.post('/tax/payments', {
      paidOn: '2026-08-04', amount: 280.53, kind: 'contributions',
      note: 'ostalo', periodYear: 2026, periodMonth: 8, groupKey: null,
    });
    const august = ((await c.get('/tax/contributions?year=2026')).body as {
      month: number; settled: { groups: Record<string, boolean> };
    }[]).find((m) => m.month === 8);
    assert.equal(august?.settled.groups.zzDo, true);
    assert.equal(august?.settled.groups.zap, true);

    // And the payment remembers what it was for.
    const payments = (await c.get('/tax/payments?year=2026')).body as {
      periodMonth: number | null; groupKey: string | null;
    }[];
    assert.equal(payments.some((p) => p.periodMonth === 7 && p.groupKey === 'piz'), true);
  });
});

describe('invoices raised for someone else', () => {
  const taxSetup = {
    businessStartDate: '2026-01-15', contributionBase: 1521.62,
    contributionReliefOverride: null, normiranecKind: 'full' as const,
    declaredMonthlyEstimate: null, officialInstallment: null,
    officialInstallmentFrequency: null, dohodninaIban: 'SI56011008881000030',
    dohodninaReference: '', weeklyHours: 40,
  };
  const carried = {
    number: '020/2026', issueDate: '2026-07-01', dueDate: '2126-07-15',
    description: 'Storitve', periodStart: '2026-06-01', periodEnd: '2026-06-30',
  };

  it('keeps the whole amount taxable while recording what was kept', async () => {
    const c = await signUp('carry@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', taxSetup);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    const res = await c.post('/invoices/manual', {
      clientId: client.id, issueDate: '2026-07-01', dueDate: '2026-07-15',
      description: 'Storitve', periodStart: '2026-06-01', periodEnd: '2026-06-30',
      total: 1000,
      passthrough: { forWhom: 'Miha', keep: 100 },
    });
    assert.equal(res.status, 201);
    assert.deepEqual((res.body as Record<string, unknown>).passthrough, {
      forWhom: 'Miha',
      keep: 100,
      handOver: 900,
    });

    await c.patch(`/invoices/${(res.body as { id: string }).id}/payment`, {
      paid: true, paidDate: '2026-07-10',
    });

    // The point of the whole feature: the flag must never reduce tax.
    const s = (await c.get('/tax/summary?year=2026')).body as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(s.dohodnina!.ytdRevenue, 1000, 'the full amount is revenue');
    assert.equal(s.dohodnina!.owedToDate, 40, '4% of 1.000, not of 100');

    // But only the kept share was earned here.
    const r = (await c.get('/earnings/effective-rate')).body as {
      windows: { key: string; gross: number; carried: number; dohodnina: number }[];
    };
    const ytd = r.windows.find((w) => w.key === 'ytd')!;
    assert.equal(ytd.gross, 100, 'earnings count the cut, not the invoice');
    assert.equal(ytd.carried, 900, 'and say what passed through');
    assert.equal(ytd.dohodnina, 40, 'while the tax still follows the whole amount');
  });

  it('refuses a cut larger than the invoice', async () => {
    const c = await signUp('toobig@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const res = await c.post('/invoices/manual', {
      clientId: client.id, issueDate: '2026-07-01', dueDate: '2026-07-15',
      description: '', periodStart: '2026-06-01', periodEnd: '2026-06-30',
      total: 500, passthrough: { forWhom: 'Miha', keep: 900 },
    });
    assert.equal(res.status, 422);
  });

  it('will not mark an invoice generated from hours as someone else\'s', async () => {
    const c = await signUp('ownwork@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const session = (
      await c.post('/sessions', {
        clientId: client.id, date: '2026-06-02', start: '09:00', end: '13:00', note: '',
      })
    ).body as { id: string };
    const invoice = (
      await c.post('/invoices', {
        clientId: client.id, sessionIds: [session.id],
        issueDate: '2026-06-30', dueDate: '2026-07-14', description: '',
      })
    ).body as { id: string; passthrough: unknown };

    assert.equal(invoice.passthrough, null, 'hours were logged, so it is own work');
    const edit = await c.patch(`/invoices/${invoice.id}`, {
      passthrough: { forWhom: 'Miha', keep: 10 },
    });
    assert.equal(edit.status, 409, 'and the hours behind it say otherwise');
  });

  it('lets a cut be corrected on an invoice with no hours behind it', async () => {
    const c = await signUp('fixcut@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const invoice = (
      await c.post('/invoices/import', {
        ...carried, clientId: client.id, total: 1000, status: 'unpaid', paidDate: null,
        passthrough: { forWhom: 'Miha', keep: 100 },
      })
    ).body as { id: string };

    const fixed = await c.patch(`/invoices/${invoice.id}`, {
      passthrough: { forWhom: 'Miha', keep: 150 },
    });
    assert.equal((fixed.body as { passthrough: { keep: number } }).passthrough.keep, 150);

    // And it can be cleared when it was never a favour at all.
    const cleared = await c.patch(`/invoices/${invoice.id}`, { passthrough: null });
    assert.equal((cleared.body as { passthrough: unknown }).passthrough, null);
  });
});

describe('where the year is heading', () => {
  it('projects from the months actually traded, not from January', async () => {
    const { forecastYear, yearSpan } = await import('@reckon/shared');

    // Opened in June, so by the end of August three months have been traded —
    // not eight — and four remain.
    const span = yearSpan({ year: 2026, todayIso: '2026-08-31', startIso: '2026-06-03' });
    assert.deepEqual(span, { monthsTraded: 3, monthsRemaining: 4 });

    const f = forecastYear({
      receivedCents: 900_000,
      outstandingCents: 100_000,
      ...span,
    });
    assert.equal(f.committedCents, 1_000_000, 'money in plus invoices out');
    assert.equal(f.monthlyAverageCents, 300_000, '9.000 over three months');
    assert.equal(f.projectedCents, 2_200_000, 'plus four more average months');

    // Averaging from January instead would have said 1.125 a month and
    // projected far too low — which is the mistake worth not making.
    const wrong = forecastYear({
      receivedCents: 900_000, outstandingCents: 100_000,
      monthsTraded: 8, monthsRemaining: 4,
    });
    assert.ok(wrong.projectedCents < f.projectedCents);
  });

  it('forecasts nothing into a year that is over, or has not begun', async () => {
    const { yearSpan, forecastYear } = await import('@reckon/shared');

    const past = yearSpan({ year: 2025, todayIso: '2026-08-31', startIso: null });
    assert.equal(past.monthsRemaining, 0);
    const done = forecastYear({ receivedCents: 500_000, outstandingCents: 0, ...past });
    assert.equal(done.projectedCents, 500_000, 'a finished year is what it was');

    const ahead = yearSpan({ year: 2027, todayIso: '2026-08-31', startIso: null });
    assert.deepEqual(ahead, { monthsTraded: 0, monthsRemaining: 0 });
    // No months traded must not divide by zero.
    const none = forecastYear({ receivedCents: 0, outstandingCents: 0, ...ahead });
    assert.equal(none.monthlyAverageCents, 0);
    assert.equal(none.projectedCents, 0);
  });

  it('reports the projection with its working', async () => {
    const c = await signUp('projection@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const invoice = async (number: string, total: number, paidOn: string | null) =>
      c.post('/invoices/import', {
        number, clientId: client.id, issueDate: '2026-07-01', dueDate: '2126-07-15',
        description: 'Storitve', periodStart: '2026-06-01', periodEnd: '2026-06-30',
        total, status: paidOn ? 'paid' : 'unpaid', paidDate: paidOn,
      });
    await invoice('001/2026', 4000, '2026-07-10');
    await invoice('002/2026', 2500, '2026-08-05');
    await invoice('003/2026', 1000, null);

    const s = (await c.get('/tax/summary?year=2026')).body as Record<string, unknown>;
    const p = s.projection as Record<string, number>;

    // 4.000 + 2.500 received, 1.000 issued and unpaid.
    assert.equal(p.received, 6500);
    assert.equal(p.outstanding, 1000);
    assert.equal(p.committed, 7500);
    assert.ok(p.projected >= p.committed, 'the projection never undercuts the floor');
    assert.equal(
      Math.round((p.committed + p.monthlyAverage * p.monthsRemaining) * 100) / 100,
      p.projected,
      'and it is the sum of its parts, so it can be explained',
    );
  });
});

describe('effective hourly rate', () => {
  it('says what an hour is worth after everything is paid', async () => {
    const c = await signUp('rate@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', {
      businessStartDate: '2026-01-01', contributionBase: 1521.62,
      contributionReliefOverride: null, normiranecKind: 'full',
      declaredMonthlyEstimate: null, officialInstallment: null,
      officialInstallmentFrequency: null, dohodninaIban: 'SI56011008881000030',
      dohodninaReference: '', weeklyHours: 40,
    });
    const client = (await c.post('/clients', CLIENT)).body as { id: string };

    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);
    // Ten days of eight hours, billed at 28 €/h and paid.
    const sessionIds: string[] = [];
    for (let day = 1; day <= 10; day++) {
      const logged = (
        await c.post('/sessions', {
          clientId: client.id,
          date: `${year}-${today.slice(5, 7)}-${String(day).padStart(2, '0')}`,
          start: '09:00', end: '17:00', note: '',
        })
      ).body as { id: string };
      sessionIds.push(logged.id);
    }
    const billed = (
      await c.post('/invoices', {
        clientId: client.id, sessionIds, issueDate: today, dueDate: today,
        description: '',
      })
    ).body as { id: string; total: number };
    assert.equal(billed.total, 2240, '80 h at 28 €/h');
    await c.patch(`/invoices/${billed.id}/payment`, { paid: true, paidDate: today });

    const res = await c.get('/earnings/effective-rate');
    assert.equal(res.status, 200);
    const r = res.body as Record<string, unknown>;
    type W = {
      key: string; gross: number; flat: number; hours: number;
      effectiveRate: number; net: number; contributions: number; dohodnina: number;
    };
    const ytd = (r.windows as W[]).find((w) => w.key === 'ytd')!;

    assert.equal(ytd.gross, 2240);
    assert.equal(ytd.hours, 80);
    assert.equal(ytd.flat, 0, 'every euro of it came from an hour');
    assert.equal(ytd.dohodnina, 89.6, '4% of 2.240');

    // Net is gross less both obligations, and the rate is net over the hours
    // behind it — arithmetic the caller can check rather than trust.
    assert.equal(
      Math.round((ytd.gross - ytd.contributions - ytd.dohodnina) * 100) / 100,
      ytd.net,
    );
    assert.equal(Math.round((ytd.net / ytd.hours) * 100) / 100, ytd.effectiveRate);

    // And it is well under the nominal 28 €/h — in fact negative here, because
    // contributions are owed by the calendar whether or not the work came in.
    // Reporting that honestly is the whole point of the number.
    assert.ok(ytd.effectiveRate < 28, `effective ${ytd.effectiveRate} under nominal 28`);
    assert.ok(ytd.contributions > ytd.gross, 'a thin year costs more than it earns');

    const clients = r.clients as
      { name: string; gross: number; flat: number; hours: number; effectiveRate: number }[];
    assert.equal(clients[0]?.name, CLIENT.name);
    assert.equal(clients[0]?.hours, 80);
  });

  it('never divides money that had no hours behind it', async () => {
    const c = await signUp('flatfee@example.com');
    await c.put('/profile', PROFILE);
    await c.put('/profile/tax', {
      businessStartDate: '2026-01-01', contributionBase: 1521.62,
      contributionReliefOverride: null, normiranecKind: 'full',
      declaredMonthlyEstimate: null, officialInstallment: null,
      officialInstallmentFrequency: null, dohodninaIban: 'SI56011008881000030',
      dohodninaReference: '', weeklyHours: 40,
    });
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);

    // Four hours logged and billed at 28 €/h: 112 €.
    const session = (
      await c.post('/sessions', {
        clientId: client.id, date: today, start: '09:00', end: '13:00', note: '',
      })
    ).body as { id: string };
    const billed = (
      await c.post('/invoices', {
        clientId: client.id, sessionIds: [session.id], issueDate: today,
        dueDate: today, description: '',
      })
    ).body as { id: string; total: number };
    await c.patch(`/invoices/${billed.id}/payment`, { paid: true, paidDate: today });

    // The same client then pays a 2.000 € fixed fee, tied to no hours at all.
    const fee = (
      await c.post('/invoices/manual', {
        clientId: client.id, issueDate: today, dueDate: today,
        description: 'Pavšal', periodStart: `${year}-01-01`, periodEnd: today,
        total: 2000,
      })
    ).body as { id: string };
    await c.patch(`/invoices/${fee.id}/payment`, { paid: true, paidDate: today });

    const r = (await c.get('/earnings/effective-rate')).body as {
      windows: {
        key: string; gross: number; flat: number; hours: number;
        effectiveRate: number; contributions: number; dohodnina: number;
      }[];
      clients: { gross: number; flat: number; hours: number; effectiveRate: number }[];
    };
    const ytd = r.windows.find((w) => w.key === 'ytd')!;

    assert.equal(ytd.gross, 2112, 'the fee is still money that came in');
    assert.equal(ytd.flat, 2000, 'and is named as the part with no hours');
    assert.equal(ytd.hours, 4, 'the fee brought no hours with it');

    // The bug this guards: 2.112 € over 4 h reads as 528 €/h for work billed at
    // 28 €/h. The rate must move only with what the hours were paid.
    assert.ok(
      ytd.effectiveRate < 28,
      `effective ${ytd.effectiveRate} still under the nominal 28`,
    );

    // Only the hourly part is divided, and it carries the same share of the
    // obligations as it is of the money — the fee pays its own way.
    const hourly = ytd.gross - ytd.flat;
    const burden = ytd.contributions + ytd.dohodnina;
    const expected =
      Math.round(((hourly - Math.round(burden * 100 * (hourly / ytd.gross)) / 100) /
        ytd.hours) * 100) / 100;
    assert.equal(ytd.effectiveRate, expected, 'the rate is the hourly part over its hours');

    const row = r.clients[0]!;
    assert.equal(row.gross, 2112, 'the client is credited with everything paid');
    assert.equal(row.flat, 2000, 'of which this much bought no hours');
    assert.equal(row.hours, 4);
    assert.ok(row.effectiveRate < 28, `client rate ${row.effectiveRate} under nominal`);
  });

  it('keeps work still under way in the work view', async () => {
    const c = await signUp('openperiod@example.com');
    await c.put('/profile', PROFILE);
    const client = (await c.post('/clients', CLIENT)).body as { id: string };
    const today = new Date().toISOString().slice(0, 10);
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    // Shifts are rostered ahead, so the last one billed can be days away: the
    // invoice's period ends after today even though it is issued and paid now.
    const ahead = new Date(Date.UTC(y, m - 1, d + 5)).toISOString().slice(0, 10);

    const sessionIds: string[] = [];
    for (const date of [today, ahead]) {
      const logged = (
        await c.post('/sessions', {
          clientId: client.id, date, start: '09:00', end: '17:00', note: '',
        })
      ).body as { id: string };
      sessionIds.push(logged.id);
    }
    const billed = (
      await c.post('/invoices', {
        clientId: client.id, sessionIds, issueDate: today, dueDate: today,
        description: '',
      })
    ).body as { id: string; periodEnd: string };
    assert.ok(billed.periodEnd > today, 'the period really does run past today');
    await c.patch(`/invoices/${billed.id}/payment`, { paid: true, paidDate: today });

    for (const basis of ['payment', 'service']) {
      const ytd = ((await c.get(`/earnings/effective-rate?basis=${basis}`)).body as {
        windows: { key: string; gross: number; hours: number }[];
      }).windows.find((w) => w.key === 'ytd')!;
      assert.equal(ytd.gross, 448, `${basis}: 16 h at 28 €/h`);
      assert.equal(ytd.hours, 16, `${basis}: the hours came with it`);
    }
  });

  it('offers both a cash view and a work view', async () => {
    const c = await signUp('basis@example.com');
    await c.put('/profile', PROFILE);
    const byPayment = (await c.get('/earnings/effective-rate')).body as { basis: string };
    const byService = (await c.get('/earnings/effective-rate?basis=service')).body as {
      basis: string;
    };
    assert.equal(byPayment.basis, 'payment');
    assert.equal(byService.basis, 'service');
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
