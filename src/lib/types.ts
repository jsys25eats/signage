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

export type Settings = {
  /** 新しく追加するリンクの既定表示秒数 */
  defaultLinkDuration: number;
  /** 動画の音声を出すか */
  videoSound: boolean;
};

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
