import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="max-w-md text-center">
        <div className="font-mono text-[64px] font-semibold tracking-[-0.05em] text-muted-foreground/40">404</div>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
          No case <span className="font-serif font-normal italic text-accent">at this address.</span>
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">The page may have moved, or the case ID doesn&apos;t exist.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="grid h-9 place-items-center rounded-full bg-primary px-5 text-[13px] font-medium text-primary-foreground">Home</Link>
          <Link href="/cases" className="grid h-9 place-items-center rounded-full border border-border px-5 text-[13px] hover:bg-elevated">Case queue</Link>
        </div>
      </div>
    </div>
  );
}
