"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-3 flex gap-2">
      <input
        readOnly
        value={url}
        className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm"
        onFocus={(event) => event.currentTarget.select()}
      />
      <button
        type="button"
        className="h-11 shrink-0 rounded-xl bg-forest px-4 text-sm font-medium text-background"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
