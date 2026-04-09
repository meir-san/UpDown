import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/60 px-6 py-12 text-center",
        className
      )}
    >
      {title ? (
        <p className="font-display text-lg font-bold text-foreground">{title}</p>
      ) : null}
      <p className={cn("max-w-md text-sm leading-relaxed text-muted", title && "mt-2")}>
        {children}
      </p>
    </div>
  );
}
