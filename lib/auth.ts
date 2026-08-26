"use client";

/** Mock auth for the skeleton. The real thing posts to the auth service with
 *  platform:"maps" and gates on admin_type / superuser — the same call the other
 *  AB apps already make. Shape kept identical so the swap is one function. */

const KEY = "ab-analytics.session";

export interface Session {
  username: string;
  name: string;
  initials: string;
  role: "admin";
}

const ADMINS: Record<string, { password: string; name: string }> = {
  admin_lars: { password: "admin", name: "Lars Admin" },
  admin: { password: "admin", name: "Lars Admin" },
};

export function signIn(username: string, password: string): Session {
  const rec = ADMINS[username.trim().toLowerCase()];
  if (!rec || rec.password !== password) {
    throw new Error("Feil brukernavn eller passord.");
  }
  const initials = rec.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const session: Session = { username, name: rec.name, initials, role: "admin" };
  window.localStorage.setItem(KEY, JSON.stringify(session));
  return session;
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
  window.localStorage.removeItem(KEY);
}
