import { useCallback, useEffect, useRef, useState } from "react";
import { CloudOff, Maximize, Minimize, Pin, Settings, VolumeX } from "lucide-react";
import { useRoom } from "@/hooks/useRoom";
import { useQrCode } from "@/components/RemoteCard";
import { deleteVideo, getVideo } from "@/lib/storage";
import { getLocalRoomId, remoteUrl } from "@/lib/room";
import { getTicker, type LinkItem, type PlaylistItem } from "@/lib/types";
import { BAND, LTicker } from "@/components/LTicker";
import { cn } from "@/lib/utils";

type Position = { id: string | null; index: number; nonce: number };

const CONTROLS_HIDE_MS = 2500;
const VIDEO_ERROR_SKIP_MS = 1500;

export function DisplayPage() {
  const [roomId] = useState(getLocalRoomId);
  const { playlist, connected, sendStatus } = useRoom(roomId, "display", {
    localCache: true,
    onCommand: (cmd) => {
      if (cmd.command === "next") go(1);
      else if (cmd.command === "prev") go(-1);
      else jump(cmd.id);
    },
  });
  const items = playlist?.items ?? [];
  const settings = playlist?.settings;

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pinnedId = items.some((i) => i.id === playlist?.pinnedId) ? playlist!.pinnedId! : null;
  const pinnedRef = useRef(pinnedId);
  pinnedRef.current = pinnedId;
  const [pos, setPos] = useState<Position>({ id: null, index: 0, nonce: 0 });

  // プレイリストが更新されたら、再生中のアイテムを維持したまま位置を合わせる
  useEffect(() => {
    setPos((p) => {
      if (items.length === 0) return { id: null, index: 0, nonce: p.nonce + 1 };
      const found = p.id ? items.findIndex((i) => i.id === p.id) : -1;
      if (found >= 0) return found === p.index ? p : { ...p, index: found };
      const index = Math.min(p.index, items.length - 1);
      return { id: items[index].id, index, nonce: p.nonce + 1 };
    });
  }, [items]);

  // 固定中は前後移動しない（delta = 0 は同じアイテムの再生し直し）
  const go = useCallback((delta: number) => {
    const list = itemsRef.current;
    if (list.length === 0 || (pinnedRef.current && delta !== 0)) return;
    setPos((p) => {
      const index = (((p.index + delta) % list.length) + list.length) % list.length;
      return { id: list[index].id, index, nonce: p.nonce + 1 };
    });
  }, []);

  const moveTo = useCallback((id: string) => {
    const index = itemsRef.current.findIndex((i) => i.id === id);
    if (index >= 0) setPos((p) => ({ id, index, nonce: p.nonce + 1 }));
  }, []);

  const jump = useCallback(
    (id: string) => {
      if (!pinnedRef.current) moveTo(id);
    },
    [moveTo],
  );

  // 固定されたらそのアイテムへ切り替える。解除後はそこから通常どおり進む
  useEffect(() => {
    if (pinnedId) moveTo(pinnedId);
  }, [pinnedId, moveTo]);

  const advance = useCallback(() => go(pinnedRef.current ? 0 : 1), [go]);

  // 再生位置を操作画面へ通知
  useEffect(() => {
    if (playlist) sendStatus({ id: pos.id, index: pos.index });
  }, [playlist, pos.id, pos.index, sendStatus]);

  // 他の端末でプレイリストから外された動画ファイルを片付ける
  const prevVideoIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!playlist) return;
    const ids = new Set(items.filter((i) => i.type === "video").map((i) => i.id));
    for (const id of prevVideoIds.current ?? []) {
      if (!ids.has(id)) deleteVideo(id).catch(() => {});
    }
    prevVideoIds.current = ids;
  }, [playlist, items]);

  // 設定画面で操作用リンクが再発行されたら、新しいルームに繋ぎ直す
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "signage.roomId" && e.newValue && e.newValue !== roomId) location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [roomId]);

  const current: PlaylistItem | undefined = pos.id ? items[pos.index] : undefined;
  const nextItem: PlaylistItem | undefined =
    items.length > 1 ? items[(pos.index + 1) % items.length] : undefined;

  // リンクは指定秒数で次へ（固定中は切り替えない）
  const linkDuration = current?.type === "link" && !pinnedId ? current.duration : null;
  useEffect(() => {
    if (linkDuration == null) return;
    const t = setTimeout(() => go(1), linkDuration * 1000);
    return () => clearTimeout(t);
  }, [current?.id, pos.nonce, linkDuration, go]);

  // 操作 UI・フルスクリーン
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
  }, []);
  useEffect(() => {
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS * 2);
    return () => clearTimeout(hideTimer.current);
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else return;
      showControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFullscreen, showControls]);

  useWakeLock();

  // 自動再生ポリシーで音声がブロックされたときの解除用
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [unlockTick, setUnlockTick] = useState(0);

  if (!playlist) return <div className="h-full bg-black" />;

  const ticker = getTicker(settings);
  const showTicker = ticker.enabled && ticker.text.trim() !== "";

  const layers: { key: string; item: PlaylistItem; visible: boolean }[] = [];
  if (current) {
    layers.push({
      key: current.type === "link" ? `link:${current.id}` : `video:${current.id}:${pos.nonce}`,
      item: current,
      visible: true,
    });
  }
  // 次のリンクを裏で先読みしておく
  if (nextItem?.type === "link" && nextItem.id !== current?.id) {
    layers.push({ key: `link:${nextItem.id}`, item: nextItem, visible: false });
  }

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden bg-black text-white", !controlsVisible && "cursor-none")}
      onMouseMove={showControls}
      onPointerDown={() => {
        showControls();
        if (soundBlocked) setUnlockTick((n) => n + 1);
      }}
    >
      <div
        className="absolute right-0 top-0"
        style={showTicker ? { left: BAND, bottom: BAND } : { left: 0, bottom: 0 }}
      >
        {layers.map(({ key, item, visible }) => (
          <div
            key={key}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              visible ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={!visible}
          >
            {item.type === "link" ? (
              <LinkFrame item={item} />
            ) : (
              <VideoPlayer
                id={item.id}
                sound={settings?.videoSound ?? false}
                unlockTick={unlockTick}
                onSoundBlocked={setSoundBlocked}
                onEnded={advance}
                onError={() => setTimeout(advance, VIDEO_ERROR_SKIP_MS)}
              />
            )}
          </div>
        ))}

        {items.length === 0 && <EmptyState roomId={roomId} />}
      </div>

      {showTicker && <LTicker label={ticker.label} text={ticker.text} speed={ticker.speed} />}

      {/* iframe がマウス操作を奪わないよう、全面を透明なレイヤーで覆う */}
      <div className="absolute inset-0 z-10" onDoubleClick={toggleFullscreen} />

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 bg-gradient-to-t from-black/70 to-transparent p-6 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="min-w-0 text-sm">
          {!connected && (
            <p className="mb-1 flex items-center gap-1.5 text-amber-300">
              <CloudOff className="size-4" />
              オフライン（保存済みのプレイリストで再生中）
            </p>
          )}
          {current && (
            <>
              <p className="flex items-center gap-1.5 text-white/60">
                {pos.index + 1} / {items.length}
                {pinnedId && (
                  <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs text-white">
                    <Pin className="size-3" />
                    固定中
                  </span>
                )}
              </p>
              <p className="truncate font-medium">
                {current.type === "video" ? current.name : current.title || current.url}
              </p>
            </>
          )}
        </div>
        <div className={cn("flex items-center gap-2", controlsVisible && "pointer-events-auto")}>
          <ControlButton label="全画面 (F)" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize /> : <Maximize />}
          </ControlButton>
          <a
            href="/"
            title="設定"
            className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/30 [&_svg]:size-5"
          >
            <Settings />
          </a>
        </div>
      </div>

      {soundBlocked && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs backdrop-blur">
          <VolumeX className="size-4" />
          クリックで音声オン
        </div>
      )}
    </div>
  );
}

function EmptyState({ roomId }: { roomId: string }) {
  const url = remoteUrl(roomId);
  const qr = useQrCode(url);
  return (
    <div className="absolute inset-0 z-20 grid place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-xl text-white/80">プレイリストが空です</p>
        {qr && <img src={qr} alt="スマホ操作用リンクの QR コード" className="size-48 rounded-xl bg-white p-2" />}
        <p className="text-sm text-white/60">スマホで読み取って操作するか、PC の設定画面から追加してください</p>
        <a href="/" className="text-sm text-white/60 underline hover:text-white">
          設定画面を開く
        </a>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-11 cursor-pointer place-items-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-5"
    >
      {children}
    </button>
  );
}

function LinkFrame({ item }: { item: LinkItem }) {
  return (
    <iframe
      src={item.url}
      title={item.title || item.url}
      className="h-full w-full border-0 bg-white"
      allow="autoplay; fullscreen; encrypted-media"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

function VideoPlayer({
  id,
  sound,
  unlockTick,
  onSoundBlocked,
  onEnded,
  onError,
}: {
  id: string;
  sound: boolean;
  unlockTick: number;
  onSoundBlocked: (blocked: boolean) => void;
  onEnded: () => void;
  onError: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    getVideo(id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) return onError();
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(onError);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    v.muted = !sound;
    v.play()
      .then(() => onSoundBlocked(false))
      .catch((e: DOMException) => {
        if (e.name !== "NotAllowedError") return;
        // 音声付き自動再生がブロックされたらミュートで再生する
        v.muted = true;
        onSoundBlocked(sound);
        v.play().catch(() => {});
      });
  }, [src, sound]);

  useEffect(() => {
    const v = ref.current;
    if (!v || unlockTick === 0 || !sound) return;
    v.muted = false;
    onSoundBlocked(false);
  }, [unlockTick]);

  return (
    <video
      ref={ref}
      src={src}
      className="h-full w-full object-contain"
      playsInline
      preload="auto"
      onEnded={onEnded}
      onError={onError}
    />
  );
}

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible") lock = await navigator.wakeLock?.request("screen");
      } catch {
        // 非対応・拒否時は無視
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, []);
}
