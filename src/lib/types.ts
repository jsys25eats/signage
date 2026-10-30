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

/** L字（左端と下端）に流すテロップ。左列と下列で別々の文言を流す */
export type TickerSettings = {
  enabled: boolean;
  /** 左列（縦書き・下から上へ）。空なら左の帯を出さない */
  left: string;
  /** 下列（右から左へ）。空なら下の帯を出さない */
  bottom: string;
  speed: TickerSpeed;
};

export const DEFAULT_TICKER: TickerSettings = { enabled: false, left: "", bottom: "", speed: "normal" };

export type Settings = {
  /** 新しく追加するリンクの既定表示秒数 */
  defaultLinkDuration: number;
  /** 動画の音声を出すか */
  videoSound: boolean;
  /** 古いデータには無いことがあるので getTicker() 経由で読む */
  ticker?: TickerSettings;
};

export function getTicker(settings: Settings | undefined): TickerSettings {
  // 以前の 1 本だけの形式（text）は下列として扱う
  const old = settings?.ticker as (Partial<TickerSettings> & { text?: string }) | undefined;
  return {
    enabled: old?.enabled ?? DEFAULT_TICKER.enabled,
    left: old?.left ?? DEFAULT_TICKER.left,
    bottom: old?.bottom ?? old?.text ?? DEFAULT_TICKER.bottom,
    speed: old?.speed ?? DEFAULT_TICKER.speed,
  };
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
