import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@/lib/dnd";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  GripVertical,
  Link2,
  Loader2,
  Monitor,
  Play,
  Plus,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { useRoom } from "@/hooks/useRoom";
import { deleteVideo, estimateStorage, putVideo, requestPersistence } from "@/lib/storage";
import type { DisplayState } from "@/lib/protocol";
import { RemoteCard } from "@/components/RemoteCard";
import type { LinkItem, PlaylistItem } from "@/lib/types";
import { cn, formatBytes, uid } from "@/lib/utils";

function openDisplay() {
  window.open("/display", "signage-display");
}

/**
 * プレイリストの設定・操作画面。
 * isLocal: 表示用 PC と同じブラウザで開いている（動画ファイルを追加できる）
 */
export function SettingsPage({ roomId, isLocal }: { roomId: string; isLocal: boolean }) {
  const { playlist, connected, display, update, command } = useRoom(roomId, "controller", {
    localCache: isLocal,
  });
  const [storage, setStorage] = useState<StorageEstimate>();

  const refreshStorage = () => estimateStorage().then(setStorage);
  useEffect(() => {
    if (!isLocal) return;
    requestPersistence();
    refreshStorage();
  }, [isLocal]);

  if (!playlist) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          接続中…
        </div>
      </div>
    );
  }
  const { items, settings } = playlist;
  const currentId = display.online ? (display.status?.id ?? null) : null;

  const removeItem = async (item: PlaylistItem) => {
    await update((p) => ({ ...p, items: p.items.filter((i) => i.id !== item.id) }));
    // 他の端末から削除された場合は、表示画面側が動画ファイルを片付ける
    if (item.type === "video" && isLocal) {
      await deleteVideo(item.id);
      refreshStorage();
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    update((p) => ({ ...p, items: arrayMove(p.items, from, to) }));
  };

  const updateLink = (id: string, patch: Partial<LinkItem>) =>
    update((p) => ({
      ...p,
      items: p.items.map((i) => (i.id === id && i.type === "link" ? { ...i, ...patch } : i)),
    }));

  const totalLinkSeconds = items.reduce((s, i) => (i.type === "link" ? s + i.duration : s), 0);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-full">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Monitor className="size-4" />
              </div>
              <h1 className="text-lg font-semibold">{isLocal ? "サイネージ設定" : "サイネージ操作"}</h1>
              <ConnectionBadge connected={connected} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Tooltip content="前のアイテムへ">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="前のアイテムへ"
                  disabled={!display.online}
                  onClick={() => command({ command: "prev" })}
                >
                  <ChevronLeft />
                </Button>
              </Tooltip>
              <Tooltip content="次のアイテムへ">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="次のアイテムへ"
                  disabled={!display.online}
                  onClick={() => command({ command: "next" })}
                >
                  <ChevronRight />
                </Button>
              </Tooltip>
              {isLocal && (
                <Button onClick={openDisplay}>
                  <ExternalLink />
                  表示画面を開く
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <NowPlayingCard display={display} items={items} />

          <Card className="min-w-0 self-start lg:col-start-1 lg:row-span-5 lg:row-start-1">
            <CardHeader className="flex-row items-end justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle>プレイリスト</CardTitle>
                <CardDescription>
                  {items.length} 件 ・ ドラッグまたは矢印で並べ替え。最後まで再生したら先頭に戻ります。
                </CardDescription>
              </div>
              {items.length > 0 && (
                <ConfirmDialog
                  title="プレイリストを空にしますか？"
                  description="保存した動画ファイルも削除されます。"
                  confirmLabel="すべて削除"
                  onConfirm={async () => {
                    const videos = items.filter((i) => i.type === "video");
                    await update((p) => ({ ...p, items: [] }));
                    await Promise.all(videos.map((v) => deleteVideo(v.id)));
                    refreshStorage();
                  }}
                  trigger={
                    <Button variant="ghost" size="sm" className="text-destructive">
                      すべて削除
                    </Button>
                  }
                />
              )}
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="grid place-items-center rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                  まだ何もありません。右のパネルから動画やリンクを追加してください。
                </div>
              ) : (
                <SortableList
                  items={items}
                  currentId={currentId}
                  canJump={display.online}
                  onReorder={(from, to) => move(from, to)}
                  onRemove={removeItem}
                  onUpdateLink={updateLink}
                  onJump={(id) => command({ command: "jump", id })}
                />
              )}
              {totalLinkSeconds > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  リンクの表示時間合計: {formatDuration(totalLinkSeconds)}（＋動画の再生時間）
                </p>
              )}
            </CardContent>
          </Card>

          {isLocal ? (
            <AddVideoCard
              onAdd={async (files) => {
                const added: PlaylistItem[] = [];
                for (const file of files) {
                  const id = uid();
                  await putVideo(id, file);
                  added.push({ id, type: "video", name: file.name, size: file.size });
                }
                await update((p) => ({ ...p, items: [...p.items, ...added] }));
                refreshStorage();
              }}
            />
          ) : (
            <Card className="lg:col-start-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="size-4 text-video" />
                  動画の追加
                </CardTitle>
                <CardDescription>
                  動画ファイルは表示用 PC に保存されるため、追加は PC の設定画面から行ってください。並べ替え・削除はここからできます。
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <AddLinkCard
            defaultDuration={settings.defaultLinkDuration}
            onAdd={(link) => update((p) => ({ ...p, items: [...p.items, link] }))}
          />

          <Card className="lg:col-start-2">
            <CardHeader>
              <CardTitle>全体設定</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="default-duration">リンクの既定表示時間（秒）</Label>
                <SecondsInput
                  id="default-duration"
                  value={settings.defaultLinkDuration}
                  onCommit={(v) =>
                    update((p) => ({ ...p, settings: { ...p.settings, defaultLinkDuration: v } }))
                  }
                />
                <ConfirmDialog
                  title="すべてのリンクに適用しますか？"
                  description={`登録済みのリンクの表示時間をすべて ${settings.defaultLinkDuration} 秒にします。`}
                  confirmLabel="適用"
                  onConfirm={() =>
                    update((p) => ({
                      ...p,
                      items: p.items.map((i) =>
                        i.type === "link" ? { ...i, duration: p.settings.defaultLinkDuration } : i,
                      ),
                    }))
                  }
                  trigger={
                    <Button variant="outline" size="sm" className="self-start">
                      全リンクに適用
                    </Button>
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="video-sound">動画の音声を出す</Label>
                  <span className="text-xs text-muted-foreground">
                    ブラウザの制限で、表示画面を一度クリックするまで無音になる場合があります。
                  </span>
                </div>
                <Switch
                  id="video-sound"
                  checked={settings.videoSound}
                  onCheckedChange={(v) =>
                    update((p) => ({ ...p, settings: { ...p.settings, videoSound: v } }))
                  }
                />
              </div>
              {isLocal && storage?.usage !== undefined && (
                <p className="text-xs text-muted-foreground">
                  ブラウザ内の使用容量: {formatBytes(storage.usage)}
                  {storage.quota ? ` / ${formatBytes(storage.quota)}` : ""}
                </p>
              )}
            </CardContent>
          </Card>

          {isLocal && <RemoteCard roomId={roomId} />}
        </main>
      </div>
    </TooltipProvider>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${s > 0 ? `${s}秒` : ""}` : `${s}秒`;
}

function SecondsInput({
  value,
  onCommit,
  className,
  id,
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n >= 1) {
      if (n !== value) onCommit(n);
      setDraft(String(n));
    } else {
      setDraft(String(value));
    }
  };

  return (
    <Input
      id={id}
      type="number"
      min={1}
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={className}
    />
  );
}

function AddVideoCard({ onAdd }: { onAdd: (files: File[]) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  const handle = async (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("video/"));
    if (files.length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      await onAdd(files);
    } catch (e) {
      setError(e instanceof Error && e.name === "QuotaExceededError" ? "容量不足のため保存できませんでした。" : String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card className="lg:col-start-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="size-4 text-video" />
          動画を追加
        </CardTitle>
        <CardDescription>再生が終わると次のアイテムへ進みます。ファイルはこのブラウザ内に保存されます。</CardDescription>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handle(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-wait disabled:opacity-60",
            dragging && "border-primary bg-primary/5 text-foreground",
          )}
        >
          <Upload className="size-5" />
          {busy ? "保存中…" : "クリックまたはドロップで選択（複数可）"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(e) => handle(e.target.files)}
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function normalizeUrl(raw: string) {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function AddLinkCard({
  defaultDuration,
  onAdd,
}: {
  defaultDuration: number;
  onAdd: (link: LinkItem) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError("有効な URL を入力してください。");
      return;
    }
    onAdd({
      id: uid(),
      type: "link",
      url: normalized,
      title: title.trim(),
      duration: duration ?? defaultDuration,
    });
    setUrl("");
    setTitle("");
    setDuration(null);
    setError(undefined);
  };

  return (
    <Card className="lg:col-start-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4 text-link" />
          リンクを追加
        </CardTitle>
        <CardDescription>指定した秒数だけ表示して次へ進みます。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="link-title">名前（任意）</Label>
              <Input id="link-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex w-20 flex-col gap-1.5">
              <Label htmlFor="link-duration">秒数</Label>
              <Input
                id="link-duration"
                type="number"
                min={1}
                value={duration ?? defaultDuration}
                onChange={(e) => setDuration(Math.max(1, Math.round(Number(e.target.value)) || 1))}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit">
            <Plus />
            追加
          </Button>
          <p className="text-xs text-muted-foreground">
            ※ サイトによっては埋め込み表示（iframe）を禁止しており、表示できない場合があります。
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function SortableList({
  items,
  currentId,
  canJump,
  onReorder,
  onRemove,
  onUpdateLink,
  onJump,
}: {
  items: PlaylistItem[];
  currentId: string | null;
  canJump: boolean;
  onReorder: (from: number, to: number) => void;
  onRemove: (item: PlaylistItem) => void;
  onUpdateLink: (id: string, patch: Partial<LinkItem>) => void;
  onJump: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onReorder(from, to);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              index={index}
              isLast={index === items.length - 1}
              isCurrent={item.id === currentId}
              canJump={canJump}
              onJump={() => onJump(item.id)}
              onMove={(to) => onReorder(index, to)}
              onRemove={() => onRemove(item)}
              onUpdateLink={(patch) => onUpdateLink(item.id, patch)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  index,
  isLast,
  isCurrent,
  canJump,
  onJump,
  onMove,
  onRemove,
  onUpdateLink,
}: {
  item: PlaylistItem;
  index: number;
  isLast: boolean;
  isCurrent: boolean;
  canJump: boolean;
  onJump: () => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onUpdateLink: (patch: Partial<LinkItem>) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 pr-3",
        isCurrent && "border-primary/60 bg-primary/5",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="ドラッグして並べ替え"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">
        {isCurrent ? <Volume2 className="ml-auto size-3.5 text-primary" aria-label="再生中" /> : index + 1}
      </span>
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md",
          item.type === "video" ? "bg-video/15 text-video" : "bg-link/15 text-link",
        )}
      >
        {item.type === "video" ? <Film className="size-4" /> : <Link2 className="size-4" />}
      </div>
      <div className="min-w-0 flex-1 basis-40">
        {item.type === "video" ? (
          <>
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">動画 ・ {formatBytes(item.size)} ・ 再生終了で次へ</p>
          </>
        ) : (
          <>
            <p className="truncate text-sm font-medium">{item.title || new URL(item.url).host}</p>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-muted-foreground hover:underline"
            >
              {item.url}
            </a>
          </>
        )}
      </div>
      {item.type === "link" && (
        <div className="ml-auto flex items-center gap-1">
          <SecondsInput
            value={item.duration}
            onCommit={(duration) => onUpdateLink({ duration })}
            className="h-8 w-16 px-2 text-right"
          />
          <span className="text-xs text-muted-foreground">秒</span>
        </div>
      )}
      <div className="flex items-center">
        <Tooltip content="ここから再生">
          <Button variant="ghost" size="icon-sm" aria-label="ここから再生" disabled={!canJump} onClick={onJump}>
            <Play />
          </Button>
        </Tooltip>
        <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="上へ">
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={isLast} onClick={() => onMove(index + 1)} aria-label="下へ">
          <ArrowDown />
        </Button>
        <ConfirmDialog
          title="このアイテムを削除しますか？"
          description={item.type === "video" ? item.name : item.url}
          onConfirm={onRemove}
          trigger={
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label="削除">
              <Trash2 />
            </Button>
          }
        />
      </div>
    </li>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
        connected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-muted-foreground animate-pulse")} />
      {connected ? "同期中" : "再接続中…"}
    </span>
  );
}

function NowPlayingCard({ display, items }: { display: DisplayState; items: PlaylistItem[] }) {
  const index = display.status?.id ? items.findIndex((i) => i.id === display.status!.id) : -1;
  const current = index >= 0 ? items[index] : undefined;
  return (
    <Card className="lg:col-start-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="size-4" />
          表示画面
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-xs font-normal",
              display.online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
            )}
          >
            {display.online ? "オンライン" : "オフライン"}
          </span>
        </CardTitle>
        <CardDescription>
          {!display.online
            ? "表示画面が開かれていません。"
            : current
              ? `再生中: ${index + 1}. ${current.type === "video" ? current.name : current.title || current.url}`
              : "待機中"}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
