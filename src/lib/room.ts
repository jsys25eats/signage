// このブラウザ（表示用 PC）に紐づくルーム ID。
// スマホからはこの ID を含む URL（/r/<id>）で操作する。

const KEY = "signage.roomId";

function generateRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let memoryFallback: string | null = null;

export function getLocalRoomId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = generateRoomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return (memoryFallback ??= generateRoomId());
  }
}

/** ルーム ID を作り直す（共有済みのスマホ用リンクは無効になる） */
export function regenerateLocalRoomId() {
  const id = generateRoomId();
  try {
    localStorage.setItem(KEY, id);
  } catch {
    memoryFallback = id;
  }
  return id;
}

export function remoteUrl(roomId: string) {
  return `${location.origin}/r/${roomId}`;
}
