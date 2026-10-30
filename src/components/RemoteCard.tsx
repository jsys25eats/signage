import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { regenerateLocalRoomId, remoteUrl } from "@/lib/room";

export function useQrCode(text: string) {
  const [dataUrl, setDataUrl] = useState<string>();
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: "M" }).then(setDataUrl);
  }, [text]);
  return dataUrl;
}

/** スマホから操作するためのリンクと QR コード（表示用 PC の設定画面に表示） */
export function RemoteCard({ roomId }: { roomId: string }) {
  const url = remoteUrl(roomId);
  const qr = useQrCode(url);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード非対応時は何もしない
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>スマホで操作</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {qr && (
          <img
            src={qr}
            alt="スマホ操作用リンクの QR コード"
            className="mx-auto size-40 rounded-lg bg-white p-1"
          />
        )}
        <div className="flex gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{url}</code>
          <Button variant="outline" size="icon" onClick={copy} aria-label="リンクをコピー">
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        <ConfirmDialog
          title="操作用リンクを再発行しますか？"
          description="今までのリンク（QR コード）は使えなくなります。表示画面は自動で新しいリンクに切り替わります。"
          confirmLabel="再発行"
          onConfirm={() => {
            regenerateLocalRoomId();
            location.reload();
          }}
          trigger={
            <button type="button" className="self-start text-xs text-muted-foreground underline hover:text-foreground">
              リンクを再発行（今のリンクを無効にする）
            </button>
          }
        />
      </CardContent>
    </Card>
  );
}
