"use client";

import { useEffect, useState } from "react";

export function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const initialTimer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  return now;
}
