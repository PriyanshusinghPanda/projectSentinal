"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="max-w-md text-center">
        <div className="font-mono text-xs text-risk-critical">error{error.digest ? ` · ${error.digest}` : ""}</div>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em]">Something went wrong.</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">The investigation view hit an unexpected error. Your cases are unaffected.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="h-9 rounded-full bg-primary px-5 text-[13px] font-medium text-primary-foreground">Try again</button>
          <Link href="/cases" className="grid h-9 place-items-center rounded-full border border-border px-5 text-[13px] hover:bg-elevated">Case queue</Link>
        </div>
      </div>
    </div>
  );
}
