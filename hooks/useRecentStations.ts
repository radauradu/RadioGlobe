"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RECENT_STORAGE_KEY,
  pushRecentId,
  readRecentIds,
} from "@/lib/recentStations";

export function useRecentStations() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(readRecentIds());
    setReady(true);

    function onStorage(event: StorageEvent) {
      if (event.key === RECENT_STORAGE_KEY) {
        setIds(readRecentIds());
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const track = useCallback((id: string) => {
    const next = pushRecentId(id);
    setIds(next);
    return next;
  }, []);

  return { ids, track, ready };
}
