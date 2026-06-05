import * as React from "react";
import { toast as sonnerToast } from "sonner";

import type { ToastActionElement } from "@/components/ui/toast";

const TOAST_DEDUPE_WINDOW = 2500;

type ToastVariant = "default" | "destructive";

type Toast = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: ToastVariant;
  duration?: number;
};

const recentToastMeta = new Map<string, { id: string | number; ts: number }>();

function serializeToastContent(value: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

function getToastDedupeKey(props: Toast): string {
  const title = serializeToastContent(props.title);
  const description = serializeToastContent(props.description);
  const variant = props.variant || "default";
  return `${variant}|${title}|${description}`;
}

function normalizeAction(action?: ToastActionElement) {
  if (!React.isValidElement(action)) {
    return undefined;
  }

  const props = (action.props ?? {}) as { onClick?: () => void; altText?: string; children?: React.ReactNode };
  const label = typeof props.children === "string" ? props.children : props.altText;

  if (!label || typeof props.onClick !== "function") {
    return undefined;
  }

  return {
    label,
    onClick: props.onClick,
  };
}

function emitToast(input: Toast, id?: string | number): string | number {
  const title = serializeToastContent(input.title);
  const description = serializeToastContent(input.description);
  const message = title || description || "Notification";

  const options = {
    id,
    description: title && description ? description : undefined,
    duration: input.duration,
    action: normalizeAction(input.action),
  };

  if (input.variant === "destructive") {
    return sonnerToast.error(message, options);
  }

  return sonnerToast(message, options);
}

function getToastController(id: string | number) {
  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (props: Toast) => {
      emitToast(props, id);
    },
  };
}

function toast(props: Toast) {
  const dedupeKey = getToastDedupeKey(props);
  const now = Date.now();
  const existing = recentToastMeta.get(dedupeKey);

  if (existing && now - existing.ts < TOAST_DEDUPE_WINDOW) {
    return getToastController(existing.id);
  }

  const id = emitToast(props);
  recentToastMeta.set(dedupeKey, { id, ts: now });

  for (const [key, meta] of recentToastMeta.entries()) {
    if (now - meta.ts > TOAST_DEDUPE_WINDOW * 2) {
      recentToastMeta.delete(key);
    }
  }

  return getToastController(id);
}

function useToast() {
  return {
    toasts: [],
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };
