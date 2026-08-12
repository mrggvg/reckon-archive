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

export const app = express();

app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json());
app.use(
  session({
    store: new PgStore({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
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
