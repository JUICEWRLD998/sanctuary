"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES = {
  success: {
    bg: "bg-success/10",
    border: "border-success/30",
    text: "text-success",
  },
  error: {
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    text: "text-destructive",
  },
  info: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    text: "text-primary",
  },
};

/**
 * Toast notification component for temporary feedback messages.
 * Auto-dismisses after the specified duration.
 */
export function Toast({ message, type = "info", duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = ICONS[type];
  const style = STYLES[type];

  useEffect(() => {
    // Slight delay for animation
    const showTimer = setTimeout(() => setIsVisible(true), 10);
    
    // Auto-dismiss
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for exit animation
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      } ${style.bg} ${style.border}`}
      role="alert"
      aria-live="polite"
    >
      <Icon className={`h-5 w-5 shrink-0 ${style.text}`} aria-hidden="true" />
      <p className="flex-1 text-sm text-fg">{message}</p>
      <button
        type="button"
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="shrink-0 rounded p-1 text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Toast container for managing multiple toasts.
 * Use this at the root level of your app.
 */
export function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Array<{ id: string; message: string; type?: ToastType }>;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </>
  );
}
