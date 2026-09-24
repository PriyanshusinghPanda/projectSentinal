export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-10">
          <div className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
          <div className="absolute inset-2 rounded-full bg-accent" />
        </div>
        <div className="text-xs text-muted-foreground">Loading Sentinel…</div>
      </div>
    </div>
  );
}
