const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  fields: Record<string, string> | undefined;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

interface ErrorBody {
  error?: string;
  fields?: Record<string, string>;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      ...init,
      headers: init.body
        ? { 'Content-Type': 'application/json', ...init.headers }
        : init.headers,
    });
  } catch {
    // Status 0 means the request never landed — a dead API reads differently
    // from a rejected one, and the message should say so.
    throw new ApiError(0, 'Strežnik ni dosegljiv. Ali API teče?');
  }

  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body ?? {}) as ErrorBody;
    throw new ApiError(res.status, err.error ?? 'Prišlo je do napake', err.fields);
  }
  return body as T;
}
