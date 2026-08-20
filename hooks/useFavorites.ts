"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FAVORITES_STORAGE_KEY,
  readFavoriteIds,
  toggleFavorite,
} from "@/lib/favorites";

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(readFavoriteIds());
    setReady(true);

    function onStorage(event: StorageEvent) {
      if (event.key === FAVORITES_STORAGE_KEY) {
        setIds(readFavoriteIds());
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    const next = toggleFavorite(id);
    setIds(next);
    return next;
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, isFavorite, ready };
}
