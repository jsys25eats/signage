import { DurableObject } from "cloudflare:workers";
import {
  PING,
  PONG,
  ROOM_ID_PATTERN,
  type ClientMessage,
  type DisplayState,
  type DisplayStatus,
  type Role,
  type ServerMessage,
} from "../src/lib/protocol";
import type { Playlist } from "../src/lib/types";

interface Env {
  ROOMS: DurableObjectNamespace<Room>;
}

type Attachment = { role: Role; status: DisplayStatus | null };

const MAX_MESSAGE_BYTES = 256 * 1024;
const PLAYLIST_KEY = "playlist";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (!match || !ROOM_ID_PATTERN.test(match[1])) {
      return new Response("Not found", { status: 404 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    return env.ROOMS.getByName(match[1]).fetch(request);
  },
} satisfies ExportedHandler<Env>;

/** 表示画面 1 台ぶんのプレイリストと、接続中のクライアントを管理する */
export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // 接続維持用の ping はハイバネーションを解かずに応答する
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request) {
    const role: Role = new URL(request.url).searchParams.get("role") === "display" ? "display" : "controller";
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, status: null } satisfies Attachment);

    const playlist = (await this.ctx.storage.get<Playlist>(PLAYLIST_KEY)) ?? null;
    send(server, { type: "state", playlist, display: this.displayState() });
    if (role === "display") this.broadcastDisplayState();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case "set-playlist": {
        if (!isPlaylist(msg.playlist)) return;
        await this.ctx.storage.put(PLAYLIST_KEY, msg.playlist);
        this.broadcast({ type: "playlist", playlist: msg.playlist }, { except: ws });
        break;
      }
      case "command": {
        if (msg.command === "jump" && typeof msg.id !== "string") return;
        if (!["next", "prev", "jump"].includes(msg.command)) return;
        const { type: _, ...command } = msg;
        this.broadcast({ type: "command", ...command }, { role: "display" });
        break;
      }
      case "status": {
        const att = ws.deserializeAttachment() as Attachment;
        if (att.role !== "display") return;
        ws.serializeAttachment({ ...att, status: msg.status } satisfies Attachment);
        this.broadcastDisplayState();
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.onDisconnect(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.onDisconnect(ws);
  }

  private onDisconnect(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.role === "display") this.broadcastDisplayState(ws);
  }

  private displayState(exclude?: WebSocket): DisplayState {
    const displays = this.ctx.getWebSockets("display").filter((s) => s !== exclude);
    const status = displays
      .map((s) => (s.deserializeAttachment() as Attachment).status)
      .find((s) => s !== null);
    return { online: displays.length > 0, status: status ?? null };
  }

  private broadcastDisplayState(exclude?: WebSocket) {
    this.broadcast({ type: "display", display: this.displayState(exclude) }, { role: "controller" });
  }

  private broadcast(msg: ServerMessage, opts: { role?: Role; except?: WebSocket } = {}) {
    for (const ws of this.ctx.getWebSockets(opts.role)) {
      if (ws !== opts.except) send(ws, msg);
    }
  }
}

function send(ws: WebSocket, msg: ServerMessage) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // 切断済みのソケットは無視
  }
}

function isPlaylist(p: unknown): p is Playlist {
  if (!p || typeof p !== "object") return false;
  const { items, settings } = p as Playlist;
  return (
    Array.isArray(items) &&
    items.every((i) => i && typeof i.id === "string" && (i.type === "video" || i.type === "link")) &&
    !!settings &&
    typeof settings.defaultLinkDuration === "number"
  );
}
