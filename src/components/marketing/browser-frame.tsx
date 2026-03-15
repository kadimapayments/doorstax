export function BrowserFrame({
  url = "doorstax.com/dashboard",
  children,
}: {
  url?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-secondary shadow-xl overflow-hidden">
      {/* Chrome bar */}
      <div className="flex items-center gap-2 border-b border-border bg-bg-card px-3 sm:px-4 py-2">
        <div className="flex gap-1.5 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="ml-2 sm:ml-3 flex-1 min-w-0 rounded-md bg-bg-primary/60 px-2 sm:px-3 py-1">
          <span className="text-[10px] text-text-muted font-mono truncate block">{url}</span>
        </div>
      </div>
      {/* Content */}
      <div className="p-3 sm:p-4 overflow-x-hidden">{children}</div>
    </div>
  );
}
