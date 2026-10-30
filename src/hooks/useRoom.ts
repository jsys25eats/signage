import { useCallback, useEffect, useRef, useState } from "react";
import {
  PING,
  PONG,
  type ClientMessage,
  type Command,
  type DisplayState,
  type DisplayStatus,
  type Role,
  type ServerMessage,
} from "@/lib/protocol";
import { loadPlaylist, savePlaylist } from "@/lib/storage";
import { DEFAULT_PLAYLIST, type Playlist } from "@/lib/types";

const PING_INTERVAL_MS = 25_000;
const MAX_RETRY_MS = 15_000;

type Options = {
  /** このブラウザの IndexedDB にプレイリストをキャッシュする（表示用 PC のみ） */
  localCache: boolean;
  onCommand?: (cmd: Command) => void;
};

export function useRoom(roomId: string, role: Role, { localCache, onCommand }: Options) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [connected, setConnected] = useState(false);
  const [display, setDisplay] = useState<DisplayState>({ online: false, status: null });

  const wsRef = useRef<WebSocket | null>(null);
  const latest = useRef<Playlist | null>(null);
  // 未接続中に行った変更。再接続時にサーバーへ送る
  const pending = useRef<Playlist | null>(null);
  const lastStatus = useRef<DisplayStatus | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const apply = useCallback(
    (p: Playlist) => {
      latest.current = p;
      setPlaylist(p);
      if (localCache) savePlaylist(p).catch(() => {});
    },
    [localCache],
  );

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  useEffect(() => {
    let disposed = false;
    let retry = 1000;
    let retryTimer: ReturnType<typeof setTimeout>;
    let pingTimer: ReturnType<typeof setInterval>;
    // 表示用 PC ではキャッシュから即座に表示を始め、オフラインでも動くようにする
    const cacheReady = localCache
      ? loadPlaylist()
          .then((p) => {
            if (!disposed && !latest.current) apply(p);
          })
          .catch(() => {})
      : Promise.resolve();

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${proto}//${location.host}/api/rooms/${encodeURIComponent(roomId)}/ws?role=${role}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 1000;
        setConnected(true);
        pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(PING), PING_INTERVAL_MS);
        if (lastStatus.current) send({ type: "status", status: lastStatus.current });
      };

      ws.onmessage = async (e) => {
        if (typeof e.data !== "string" || e.data === PONG) return;
        const msg = JSON.parse(e.data) as ServerMessage;
        switch (msg.type) {
          case "state": {
            setDisplay(msg.display);
            await cacheReady;
            const local = pending.current ?? (localCache ? latest.current : null);
            if (local && (pending.current || !msg.playlist)) {
              // オフライン中の変更、または新しいルームへ手元のプレイリストを送る
              pending.current = null;
              send({ type: "set-playlist", playlist: local });
            } else if (msg.playlist) {
              apply(msg.playlist);
            } else if (!latest.current) {
              apply(structuredClone(DEFAULT_PLAYLIST));
            }
            break;
          }
          case "playlist":
            apply(msg.playlist);
            break;
          case "display":
            setDisplay(msg.display);
            break;
          case "command": {
            const { type: _, ...cmd } = msg;
            onCommandRef.current?.(cmd);
            break;
          }
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        setConnected(false);
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed) return;
        retryTimer = setTimeout(connect, retry);
        retry = Math.min(retry * 2, MAX_RETRY_MS);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [roomId, role, localCache, apply, send]);

  const update = useCallback(
    async (fn: (p: Playlist) => Playlist) => {
      const next = fn(latest.current ?? structuredClone(DEFAULT_PLAYLIST));
      apply(next);
      if (!send({ type: "set-playlist", playlist: next })) pending.current = next;
    },
    [apply, send],
  );

  const command = useCallback((cmd: Command) => send({ type: "command", ...cmd }), [send]);

  const sendStatus = useCallback(
    (status: DisplayStatus) => {
      lastStatus.current = status;
      send({ type: "status", status });
    },
    [send],
  );

  return { playlist, connected, display, update, command, sendStatus };
}
