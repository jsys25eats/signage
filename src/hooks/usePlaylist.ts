import { useCallback, useEffect, useRef, useState } from "react";
import { loadPlaylist, savePlaylist } from "@/lib/storage";
import { postMessage, subscribe } from "@/lib/channel";
import type { Playlist } from "@/lib/types";

export function usePlaylist() {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const latest = useRef<Playlist | null>(null);

  const reload = useCallback(async () => {
    const p = await loadPlaylist();
    latest.current = p;
    setPlaylist(p);
  }, []);

  useEffect(() => {
    reload();
    return subscribe((msg) => {
      if (msg.type === "playlist-updated") reload();
    });
  }, [reload]);

  const update = useCallback(async (fn: (p: Playlist) => Playlist) => {
    if (!latest.current) return;
    const next = fn(latest.current);
    latest.current = next;
    setPlaylist(next);
    await savePlaylist(next);
    postMessage({ type: "playlist-updated" });
  }, []);

  return { playlist, update };
}
