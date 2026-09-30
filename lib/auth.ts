"use client";

/** Real auth against the AB auth-service.
 *
 *  TWO GATES, and they are different things:
 *    1. POST /api/auth/login with platform:"analytics" decides whether this person
 *       may have a token at all (the auth_client_policy row admits the maps user set).
 *    2. GET /api/dashboard/console/me/ decides whether they may OPEN the console
 *       (admin / sales chief / team leader). A maps_emp passes 1 and fails 2 with 403.
 *
 *  So a successful password is NOT a successful sign-in here, and the difference has
 *  to be explained to the user rather than shown as "wrong password".
 */
import { ApiError, clearTokens, getJSON, postJSON, setTokens } from "@/lib/api/http";

const KEY = "ab-analytics.session";

export type ConsoleRole = "admin" | "chief" | "leader";

export interface Session {
  username: string;
  name: string;
  initials: string;
  role: ConsoleRole;
  /** null = every team (admin) */
  teamIds: string[] | null;
  peopleInScope: number | null;
}

export interface ConsoleMe {
  user_id: string;
  username: string;
  name: string;
  initials: string;
  role: ConsoleRole;
  is_admin: boolean;
  scope: { all_teams: boolean; team_ids: string[] | null; people: number | null };
}

function store(s: Session) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

export async function signIn(username: string, password: string): Promise<Session> {
  let access: string;
  let refresh: string | undefined;
  try {
    const res = await postJSON<{ access?: string; refresh?: string }>("/api/auth/login", {
      username: username.trim(),
      password,
      platform: "analytics",
    });
    if (!res.access) throw new ApiError("Fikk ikke et gyldig token.", 500);
    access = res.access;
    refresh = res.refresh;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      throw new Error("Feil brukernavn eller passord.");
    }
    if (err instanceof ApiError && err.status === 403) {
      throw new Error("Denne kontoen har ikke tilgang til AB Analytics.");
    }
    throw new Error(err instanceof Error ? err.message : "Innlogging feilet.");
  }

  setTokens(access, refresh);

  // Gate 2. The password was right; this decides whether the console opens.
  try {
    const me = await getJSON<ConsoleMe>("/api/dashboard/console/me/");
    const session: Session = {
      username: me.username || username,
      name: me.name || username,
      initials: me.initials || "?",
      role: me.role,
      teamIds: me.scope.all_teams ? null : me.scope.team_ids ?? [],
      peopleInScope: me.scope.people,
    };
    store(session);
    return session;
  } catch (err) {
    clearTokens();
    if (err instanceof ApiError && err.status === 403) {
      throw new Error(
        "AB Analytics er for administratorer, salgssjefer og teamledere. Kontoen din har ikke den rollen.",
      );
    }
    throw new Error(err instanceof Error ? err.message : "Kunne ikke hente tilgangen din.");
  }
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function signOut() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  clearTokens();
}

/** Norwegian label for the role badge in the shell. */
export function roleLabel(role: ConsoleRole): string {
  return role === "admin" ? "Administrator" : role === "chief" ? "Salgssjef" : "Teamleder";
}
