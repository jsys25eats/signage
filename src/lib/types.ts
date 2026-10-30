export type VideoItem = {
  id: string;
  type: "video";
  name: string;
  size: number;
};

export type LinkItem = {
  id: string;
  type: "link";
  url: string;
  title: string;
  /** 表示秒数 */
  duration: number;
};

export type PlaylistItem = VideoItem | LinkItem;

export type TickerSpeed = "slow" | "normal" | "fast";

/** L字（左端と下端）に流すテロップ */
export type TickerSettings = {
  enabled: boolean;
  /** 左上に出す見出し（例: お知らせ）。空なら出さない */
  label: string;
  text: string;
  speed: TickerSpeed;
};

export const DEFAULT_TICKER: TickerSettings = { enabled: false, label: "", text: "", speed: "normal" };

export type Settings = {
  /** 新しく追加するリンクの既定表示秒数 */
  defaultLinkDuration: number;
  /** 動画の音声を出すか */
  videoSound: boolean;
  /** 古いデータには無いことがあるので getTicker() 経由で読む */
  ticker?: TickerSettings;
};

export function getTicker(settings: Settings | undefined): TickerSettings {
  return { ...DEFAULT_TICKER, ...settings?.ticker };
}

export type Playlist = {
  items: PlaylistItem[];
  settings: Settings;
  /** 固定表示中のアイテム。設定中は自動で切り替えない */
  pinnedId?: string | null;
};

/** 表示するリンクは生配信ページのみ（固定）。表示秒数だけ変更できる */
export const LIVE_ID = "live";
export const LIVE_URL = "https://live.sohosai.com/signage";
const LIVE_ITEM: LinkItem = { id: LIVE_ID, type: "link", url: LIVE_URL, title: "生配信", duration: 60 };

/**
 * 生配信アイテムがちょうど 1 つ含まれ、他のリンクは含まれない形に揃える。
 * 固定表示も生配信のみ。
 */
export function normalizePlaylist(p: Playlist): Playlist {
  const live = p.items.find((i): i is LinkItem => i.type === "link" && i.id === LIVE_ID);
  const items = p.items
    .filter((i) => i.type === "video" || i.id === LIVE_ID)
    .map((i) => (i.id === LIVE_ID ? { ...LIVE_ITEM, duration: live?.duration ?? LIVE_ITEM.duration } : i));
  if (!live) items.unshift(LIVE_ITEM);
  return { ...p, items, pinnedId: p.pinnedId === LIVE_ID ? LIVE_ID : null };
}

export const DEFAULT_PLAYLIST: Playlist = normalizePlaylist({
  items: [],
  settings: { defaultLinkDuration: LIVE_ITEM.duration, videoSound: false },
});
