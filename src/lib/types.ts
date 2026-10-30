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
  text: string;
  speed: TickerSpeed;
};

export const DEFAULT_TICKER: TickerSettings = { enabled: false, text: "", speed: "normal" };

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

export const DEFAULT_PLAYLIST: Playlist = {
  items: [],
  settings: { defaultLinkDuration: 30, videoSound: false },
};
