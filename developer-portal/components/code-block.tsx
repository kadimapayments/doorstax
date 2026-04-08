"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export default function CodeBlock({ code, language, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden my-4">
      {(title || language) && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#1a1b26] border-b border-border">
          <span className="text-xs text-text-muted font-mono uppercase tracking-wider">
            {title || language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-accent-green" />
                <span className="text-accent-green">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre className="bg-[#1a1b26] p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-text-primary">{code}</code>
      </pre>
    </div>
  );
}
