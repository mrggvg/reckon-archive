import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { router } from './router.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const PgStore = connectPgSimple(session);

/** Named for this app, so it can't collide with another on the same host. */
export const SESSION_COOKIE = 'reckon.sid';

export const app = express();

app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
// A ledger's payloads are small; a large body is a mistake or an attack.
app.use(express.json({ limit: '1mb' }));

// Behind a TLS-terminating proxy in production, the secure cookie below only
// gets set if Express is told the original request was https.
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(
  session({
    store: new PgStore({ pool, tableName: 'session', createTableIfMissing: true }),
    name: SESSION_COOKIE,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // Each request pushes the expiry out, so daily use never logs you out.
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', router);
app.use(notFound);
app.use(errorHandler); // must be last
