import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Button } from "./button";

type Props = {
  /** 指定しない場合は open / onOpenChange で開閉する */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "削除",
  onConfirm,
}: Props) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogPrimitive.Trigger asChild>{trigger}</AlertDialogPrimitive.Trigger>}
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl">
          <AlertDialogPrimitive.Title className="text-lg font-semibold">{title}</AlertDialogPrimitive.Title>
          {description && (
            <AlertDialogPrimitive.Description className="mt-2 break-all text-sm text-muted-foreground">
              {description}
            </AlertDialogPrimitive.Description>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline">キャンセル</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button variant="destructive" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
