/** Latency + failure simulation. Loading skeletons and error states are real
 *  code paths here rather than dead branches nobody ever sees. */

const FAIL_RATE = 0.02;

export const INSTANT =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_MOCK_INSTANT === "1";

export function latency(min = 150, max = 400) {
  if (INSTANT) return Promise.resolve();
  const ms = min + Math.random() * (max - min);
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function mockCall<T>(produce: () => T, opts?: { canFail?: boolean }): Promise<T> {
  await latency();
  if (opts?.canFail !== false && !INSTANT && Math.random() < FAIL_RATE) {
    throw new Error("Kunne ikke hente data fra analysemotoren.");
  }
  return produce();
}
