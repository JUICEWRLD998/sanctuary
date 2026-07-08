import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Reusable loading spinner with optional message.
 * Provides consistent loading states across the app.
 */
export function LoadingSpinner({ message, size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <Loader2
        className={`${sizeClasses[size]} animate-spin text-primary`}
        aria-hidden="true"
      />
      {message && (
        <p className="text-sm text-fg-muted" role="status">
          {message}
        </p>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
