"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** "modal" is centered; "sheet" slides in from the right as a detail panel. */
  variant?: "modal" | "sheet";
  className?: string;
  children: ReactNode;
};

/**
 * Native <dialog> wrapper. showModal() gives focus trapping, Escape-to-close,
 * inert background and top-layer stacking without a dependency.
 */
export function Dialog({ open, onOpenChange, title, description, variant = "modal", className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => onOpenChange(false)}
      // A click whose target is the <dialog> itself landed on the backdrop.
      onClick={(event) => event.target === event.currentTarget && onOpenChange(false)}
      className={cn(
        "bg-surface text-foreground shadow-2xl outline-none backdrop:bg-black/40",
        variant === "modal" &&
          "m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border p-0",
        variant === "sheet" &&
          "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-xl border-l border-border p-0 sm:w-[36rem]",
        className,
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-base font-semibold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className={cn("flex-1", variant === "sheet" && "overflow-y-auto")}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
