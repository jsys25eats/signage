// 同じブラウザ内の設定画面 ⇔ 表示画面の連携

export type ChannelMessage =
  | { type: "playlist-updated" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "jump"; id: string };

const NAME = "signage";

export function postMessage(msg: ChannelMessage) {
  const ch = new BroadcastChannel(NAME);
  ch.postMessage(msg);
  ch.close();
}

export function subscribe(handler: (msg: ChannelMessage) => void) {
  const ch = new BroadcastChannel(NAME);
  ch.onmessage = (e) => handler(e.data as ChannelMessage);
  return () => ch.close();
}
