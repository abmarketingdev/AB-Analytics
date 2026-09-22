"use client";

import { useEffect, useState } from "react";

/**
 * True below the width where the console switches to its phone layout.
 *
 * The CSS already branches at 900px; a few interactions need the same answer
 * in JavaScript (a sheet that drags instead of a drawer that slides). Starts
 * false so the server and the first client render agree.
 */
export function useIsPhone(query = "(max-width: 900px)") {
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);

  return phone;
}
