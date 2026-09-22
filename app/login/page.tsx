"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RadarMark } from "@/components/brand/RadarMark";
import { BootSequence, TAGLINE } from "@/components/brand/BootSequence";
import { signIn, getSession } from "@/lib/auth";
import { n } from "@/lib/format";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [name, setName] = useState("");
  const [doors, setDoors] = useState(38412);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (getSession()) router.replace("/");
    userRef.current?.focus();
  }, [router]);

  // The platform-wide counter, ticking. Unauthenticated in production.
  // Paused during boot: nothing behind the overlay should be re-rendering.
  useEffect(() => {
    if (booting) return;
    const id = window.setInterval(() => setDoors((d) => d + 1 + Math.floor(Math.random() * 3)), 2400);
    return () => window.clearInterval(id);
  }, [booting]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const s = signIn(username, password);
      setName(s.name.split(" ")[0]);
      setBooting(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Innlogging feilet.");
    }
  };

  if (booting) return <BootSequence name={name} onDone={() => router.replace("/")} />;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-canvas px-6">
      <div className="login-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative w-[min(390px,100%)]">
        <div className="flex flex-col items-center">
          <RadarMark size={64} mode="ambient" />
          <h1 className="mt-5 text-[22px] font-extrabold tracking-[0.14em]">AB ANALYTICS</h1>
          <p className="mt-2 text-[13px] text-iris-soft">{TAGLINE}</p>
        </div>

        <form
          onSubmit={submit}
          className="mt-8 flex flex-col gap-3 rounded-xl border border-line bg-s1 p-6"
        >
          <label className="flex flex-col gap-1.5">
            <span className="t-label">Brukernavn</span>
            <input
              ref={userRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="h-10 rounded-md border border-line2 bg-s2 px-3 text-[14px] text-fg1 outline-none transition-colors focus:border-iris"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="t-label">Passord</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-10 rounded-md border border-line2 bg-s2 px-3 text-[14px] text-fg1 outline-none transition-colors focus:border-iris"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-md bg-crit/12 px-3 py-2 text-[12.5px] text-crit">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-1 h-10 cursor-pointer rounded-md text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(140deg,#7C5CFC,#5B3FD9)" }}
          >
            Logg inn
          </button>

          <p className="mt-1 text-center text-[11.5px] text-fg3">
            Kun for administratorer. <span className="font-mono">admin / admin</span>
          </p>
        </form>

        <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-fg3">
          <span>
            <span className="text-ja">●</span> 6 tjenester · online
          </span>
          <span data-num suppressHydrationWarning>{n(doors)} dører banket</span>
        </div>
      </div>
    </main>
  );
}
