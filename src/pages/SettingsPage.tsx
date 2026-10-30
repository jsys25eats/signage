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
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  GripVertical,
  Link2,
  Loader2,
  MoreHorizontal,
  Pin,
  PinOff,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RemoteCard } from "@/components/RemoteCard";
import { useRoom } from "@/hooks/useRoom";
import { restrictToVerticalAxis } from "@/lib/dnd";
import type { DisplayState } from "@/lib/protocol";
import { deleteVideo, putVideo, requestPersistence } from "@/lib/storage";
import type { LinkItem, PlaylistItem } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

function openDisplay() {
  window.open("/display", "signage-display");
}

function itemLabel(item: PlaylistItem) {
  if (item.type === "video") return item.name;
  if (item.title) return item.title;
  try {
    const u = new URL(item.url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return item.url;
  }
}

/**
 * プレイリストの設定・操作画面。
 * isLocal: 表示用 PC と同じブラウザで開いている（動画ファイルを追加できる）
 */
export function SettingsPage({ roomId, isLocal }: { roomId: string; isLocal: boolean }) {
  const { playlist, connected, display, update, command } = useRoom(roomId, "controller", {
    localCache: isLocal,
  });

  useEffect(() => {
    if (isLocal) requestPersistence();
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
  const pinnedItem = items.find((i) => i.id === playlist.pinnedId);
  const pinnedId = pinnedItem?.id ?? null;

  const setPin = (id: string | null) => update((p) => ({ ...p, pinnedId: id }));

  const removeItem = async (item: PlaylistItem) => {
    await update((p) => ({
      ...p,
      items: p.items.filter((i) => i.id !== item.id),
      pinnedId: p.pinnedId === item.id ? null : p.pinnedId,
    }));
    // 他の端末から削除された場合は、表示画面側が動画ファイルを片付ける
    if (item.type === "video" && isLocal) await deleteVideo(item.id);
  };

  const addVideos = async (files: File[]) => {
    const added: PlaylistItem[] = [];
    for (const file of files) {
      const id = uid();
      await putVideo(id, file);
      added.push({ id, type: "video", name: file.name, size: file.size });
    }
    await update((p) => ({ ...p, items: [...p.items, ...added] }));
  };

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold">サイネージ</h1>
          <span
            className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "animate-pulse bg-amber-500")}
            title={connected ? "同期中" : "再接続中"}
          />
          {isLocal && (
            <Button className="ml-auto" onClick={openDisplay}>
              <ExternalLink />
              表示画面を開く
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5">
        <NowPlaying
          display={display}
          items={items}
          pinnedItem={pinnedItem}
          onPrev={() => command({ command: "prev" })}
          onNext={() => command({ command: "next" })}
          onUnpin={() => setPin(null)}
        />

        <Card>
          <CardHeader>
            <CardTitle>プレイリスト</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                下から動画やリンクを追加してください
              </p>
            ) : (
              <SortableList
                items={items}
                currentId={currentId}
                pinnedId={pinnedId}
                canShow={display.online && !pinnedId}
                onReorder={(from, to) => update((p) => ({ ...p, items: arrayMove(p.items, from, to) }))}
                onUpdateLink={(id, patch) =>
                  update((p) => ({
                    ...p,
                    items: p.items.map((i) => (i.id === id && i.type === "link" ? { ...i, ...patch } : i)),
                  }))
                }
                onShow={(id) => command({ command: "jump", id })}
                onPin={setPin}
                onRemove={removeItem}
              />
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <AddLinkForm
                defaultDuration={settings.defaultLinkDuration}
                onAdd={(link) => update((p) => ({ ...p, items: [...p.items, link] }))}
              />
              {isLocal ? (
                <AddVideoButton onAdd={addVideos} />
              ) : (
                <p className="text-xs text-muted-foreground">動画の追加は表示用 PC の設定画面から行えます。</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>設定</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="default-duration">リンクの表示秒数（初期値）</Label>
              <SecondsInput
                id="default-duration"
                value={settings.defaultLinkDuration}
                onCommit={(v) => update((p) => ({ ...p, settings: { ...p.settings, defaultLinkDuration: v } }))}
                className="w-20 text-right"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="video-sound">動画の音声</Label>
              <Switch
                id="video-sound"
                checked={settings.videoSound}
                onCheckedChange={(v) => update((p) => ({ ...p, settings: { ...p.settings, videoSound: v } }))}
              />
            </div>
          </CardContent>
        </Card>

        {isLocal && <RemoteCard roomId={roomId} />}
      </main>
    </div>
  );
}

function NowPlaying({
  display,
  items,
  pinnedItem,
  onPrev,
  onNext,
  onUnpin,
}: {
  display: DisplayState;
  items: PlaylistItem[];
  pinnedItem: PlaylistItem | undefined;
  onPrev: () => void;
  onNext: () => void;
  onUnpin: () => void;
}) {
  const current = items.find((i) => i.id === display.status?.id);

  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {!display.online ? "表示画面はオフラインです" : pinnedItem ? "固定表示中" : "表示中"}
        </p>
        <p className="flex items-center gap-1.5 truncate font-medium">
          {pinnedItem && <Pin className="size-4 shrink-0 text-amber-500" />}
          <span className="truncate">
            {pinnedItem ? itemLabel(pinnedItem) : current && display.online ? itemLabel(current) : "—"}
          </span>
        </p>
      </div>
      {pinnedItem ? (
        <Button variant="outline" onClick={onUnpin}>
          <PinOff />
          固定を解除
        </Button>
      ) : (
        <div className="flex gap-1">
          <Button variant="outline" size="icon" aria-label="前へ" disabled={!display.online} onClick={onPrev}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label="次へ" disabled={!display.online} onClick={onNext}>
            <ChevronRight />
          </Button>
        </div>
      )}
    </Card>
  );
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

function AddLinkForm({ defaultDuration, onAdd }: { defaultDuration: number; onAdd: (link: LinkItem) => void }) {
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError(true);
      return;
    }
    const sec = Math.round(Number(duration ?? defaultDuration));
    onAdd({
      id: uid(),
      type: "link",
      url: normalized,
      title: "",
      duration: Number.isFinite(sec) && sec >= 1 ? sec : defaultDuration,
    });
    setUrl("");
    setDuration(null);
    setError(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          aria-label="URL"
          placeholder="URL を貼り付け"
          inputMode="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(false);
          }}
          className={cn("flex-1", error && "border-destructive")}
        />
        <Input
          aria-label="表示秒数"
          type="number"
          min={1}
          inputMode="numeric"
          value={duration ?? defaultDuration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-16 text-right"
        />
        <span className="text-sm text-muted-foreground">秒</span>
        <Button type="submit" disabled={!url.trim()}>
          <Plus />
          追加
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">URL が正しくありません</p>}
    </form>
  );
}

function AddVideoButton({ onAdd }: { onAdd: (files: File[]) => Promise<void> }) {
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
      setError(e instanceof Error && e.name === "QuotaExceededError" ? "容量不足のため保存できませんでした" : String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
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
          "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-wait disabled:opacity-60",
          dragging && "border-primary bg-primary/5 text-foreground",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
        {busy ? "保存中…" : "動画を追加（ドロップ可）"}
      </button>
      <input ref={inputRef} type="file" accept="video/*" multiple hidden onChange={(e) => handle(e.target.files)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}

type RowActions = {
  onUpdateLink: (id: string, patch: Partial<LinkItem>) => void;
  onShow: (id: string) => void;
  onPin: (id: string | null) => void;
  onRemove: (item: PlaylistItem) => void;
};

function SortableList({
  items,
  currentId,
  pinnedId,
  canShow,
  onReorder,
  ...actions
}: {
  items: PlaylistItem[];
  currentId: string | null;
  pinnedId: string | null;
  canShow: boolean;
  onReorder: (from: number, to: number) => void;
} & RowActions) {
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
        <ol className="flex flex-col gap-1.5">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              isCurrent={item.id === currentId}
              isPinned={item.id === pinnedId}
              canShow={canShow}
              {...actions}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  isCurrent,
  isPinned,
  canShow,
  onUpdateLink,
  onShow,
  onPin,
  onRemove,
}: {
  item: PlaylistItem;
  isCurrent: boolean;
  isPinned: boolean;
  canShow: boolean;
} & RowActions) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-1 pr-1.5",
        isCurrent && "border-primary/50 bg-primary/5",
        isPinned && "border-amber-500/70",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="ドラッグして並べ替え"
      >
        <GripVertical className="size-4" />
      </button>
      {item.type === "video" ? (
        <Film className="size-4 shrink-0 text-video" aria-label="動画" />
      ) : (
        <Link2 className="size-4 shrink-0 text-link" aria-label="リンク" />
      )}
      <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <span className="truncate">{itemLabel(item)}</span>
        {isPinned && <Pin className="size-3.5 shrink-0 text-amber-500" aria-label="固定中" />}
      </p>
      {item.type === "link" && (
        <div className="flex items-center gap-1">
          <SecondsInput
            value={item.duration}
            onCommit={(duration) => onUpdateLink(item.id, { duration })}
            className="h-8 w-14 px-2 text-right"
          />
          <span className="text-xs text-muted-foreground">秒</span>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="メニュー">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={!canShow} onSelect={() => onShow(item.id)}>
            <Play />
            今すぐ表示
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPin(isPinned ? null : item.id)}>
            {isPinned ? <PinOff /> : <Pin />}
            {isPinned ? "固定を解除" : "これに固定"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
            <Trash2 />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="削除しますか？"
        description={itemLabel(item)}
        onConfirm={() => onRemove(item)}
      />
    </li>
  );
}
