/** MapLibre needs WebGL2 and throws GPUInitializationError without it — most
 *  often because the browser has hardware acceleration disabled, not because the
 *  machine lacks a GPU. Detect it BEFORE constructing a Map: a constructor that
 *  throws half-built leaves an object whose internals are undefined, so the
 *  React cleanup then crashes again on .remove() and buries the real cause. */
export function hasWebGL2(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}
