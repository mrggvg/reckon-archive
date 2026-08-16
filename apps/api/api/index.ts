/*
 * The serverless entry point.
 *
 * A platform function hands the Express app each request itself, so there is no
 * listen() here — `src/index.ts` keeps that for running locally. The app is
 * created at module scope on purpose: a warm instance reuses it, and with it
 * the connection pool underneath.
 */
import { app } from '../src/app.js';

export default app;
