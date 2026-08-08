"use client";

import { markdownToHtmlClient } from "@/lib/guidarr/markdown-client";
import { cn } from "@/lib/utils";
import { Eye, FileText } from "lucide-react";
import { useEffect, useState } from "react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Split-pane markdown editor with live HTML preview. */
export default function MarkdownEditor({ value, onChange, className }: MarkdownEditorProps) {
  const [html, setHtml] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    let cancelled = false;
    markdownToHtmlClient(value).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card shadow-inner", className)}>
      <div className="flex border-b border-border sm:hidden">
        <button
          type="button"
          onClick={() => setTab("edit")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium",
            tab === "edit" ? "bg-primary/10 text-primary" : "text-muted-foreground",
          )}
        >
          <FileText className="h-4 w-4" /> Edit
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium",
            tab === "preview" ? "bg-primary/10 text-primary" : "text-muted-foreground",
          )}
        >
          <Eye className="h-4 w-4" /> Preview
        </button>
      </div>

      <div className="grid min-h-[280px] flex-1 sm:grid-cols-2">
        <div className={cn("flex flex-col", tab !== "edit" && "hidden sm:flex")}>
          <div className="hidden border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:block">
            Markdown
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[280px] flex-1 resize-y bg-transparent p-4 font-mono text-sm text-foreground focus:outline-none"
            spellCheck={false}
          />
        </div>
        <div
          className={cn(
            "flex flex-col border-border sm:border-l",
            tab !== "preview" && "hidden sm:flex",
          )}
        >
          <div className="hidden border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:block">
            Live Preview
          </div>
          <div
            className="guidarr-markdown flex-1 overflow-auto p-4 text-sm text-foreground"
            dangerouslySetInnerHTML={{ __html: html || "<p class='text-muted-foreground'>Preview…</p>" }}
          />
        </div>
      </div>
    </div>
  );
}
