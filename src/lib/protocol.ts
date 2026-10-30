import type { Playlist } from "./types";

// 表示画面・操作画面 ⇔ Durable Object 間の WebSocket メッセージ

export type Role = "display" | "controller";

export type Command = { command: "next" } | { command: "prev" } | { command: "jump"; id: string };

export type DisplayStatus = { id: string | null; index: number };

export type DisplayState = { online: boolean; status: DisplayStatus | null };

export type ClientMessage =
  | { type: "set-playlist"; playlist: Playlist }
  | ({ type: "command" } & Command)
  | { type: "status"; status: DisplayStatus };

export type ServerMessage =
  | { type: "state"; playlist: Playlist | null; display: DisplayState }
  | { type: "playlist"; playlist: Playlist }
  | ({ type: "command" } & Command)
  | { type: "display"; display: DisplayState };

export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export const PING = "ping";
export const PONG = "pong";
