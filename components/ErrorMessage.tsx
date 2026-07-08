import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: "inline" | "card";
}

/**
 * Reusable error message component with optional retry action.
 * Displays user-friendly error states with consistent styling.
 */
export function ErrorMessage({
  title = "Something went wrong",
  message,
  onRetry,
  variant = "card",
}: ErrorMessageProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium text-destructive">{title}</p>
          <p className="mt-1 text-fg-muted">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-fg">{title}</h3>
      <p className="mt-2 text-balance text-sm text-fg-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
