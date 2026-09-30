/** The real transport. Replaces the latency/failure simulator in client.ts.
 *
 *  Everything the console talks to is behind its own origin (the gateway proxies
 *  /api/* to the services), so there is no base URL to configure and no CORS.
 *
 *  Errors are normalised into ApiError with a Norwegian message the UI can show
 *  directly — a raw "TypeError: Failed to fetch" must never reach a user.
 */

const ACCESS_KEY = "ab-analytics.access";
const REFRESH_KEY = "ab-analytics.refresh";

export class ApiError extends Error {
  status: number;
  /** true when re-authenticating is what fixes it */
  needsLogin: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.needsLogin = status === 401;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh?: string) {
  try {
    window.localStorage.setItem(ACCESS_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    /* private mode — the session simply won't survive a reload */
  }
}

export function clearTokens() {
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

/** Human message per status. The UI shows these verbatim, so they are Norwegian
 *  and say what to do, not what broke internally. */
function messageFor(status: number, detail?: string): string {
  if (detail && status !== 500 && status !== 502 && status !== 504) return detail;
  switch (status) {
    case 400: return "Ugyldig forespørsel. Prøv et annet filter.";
    case 401: return "Økten er utløpt. Logg inn på nytt.";
    case 403: return "Du har ikke tilgang til denne visningen.";
    case 404: return "Fant ikke dataene.";
    case 429: return "For mange forespørsler. Vent et øyeblikk.";
    case 502:
    case 503:
    case 504: return "Analysetjenesten svarer ikke akkurat nå. Prøv igjen.";
    default:  return "Noe gikk galt i analysemotoren.";
  }
}

async function refreshToken(): Promise<boolean> {
  let refresh: string | null = null;
  try {
    refresh = window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return false;
  }
  if (!refresh) return false;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.access) return false;
    setTokens(data.access, data.refresh);
    return true;
  } catch {
    return false;
  }
}

export async function getJSON<T>(path: string, params?: Record<string, string | number | undefined | null>, isRetry = false): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    // "all" is the console's own sentinel for "no filter" — never send it on.
    if (v === undefined || v === null || v === "" || v === "all") continue;
    qs.append(k, String(v));
  }
  const url = qs.toString() ? `${path}?${qs}` : path;
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
  } catch {
    // Offline, DNS, or the request was cut. Distinguishable from a server error.
    throw new ApiError("Ingen forbindelse til serveren. Sjekk nettet.", 0);
  }

  if (res.status === 401 && !isRetry) {
    if (await refreshToken()) return getJSON<T>(path, params, true);
    clearTokens();
    throw new ApiError(messageFor(401), 401);
  }

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = body?.detail || body?.error || undefined;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(messageFor(res.status, detail), res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("Fikk et uventet svar fra serveren.", res.status);
  }
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  const token = getToken();
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Ingen forbindelse til serveren. Sjekk nettet.", 0);
  }
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const b = await res.json();
      detail = b?.detail || b?.error || undefined;
    } catch {
      /* ignore */
    }
    throw new ApiError(messageFor(res.status, detail), res.status);
  }
  return (await res.json()) as T;
}
