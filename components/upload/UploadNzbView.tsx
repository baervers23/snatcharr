"use client";

import { cn, formatBytes } from "@/lib/utils";
import { ExternalLink, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const NZB_SITES = [
  { label: "NZBKing", url: "https://www.nzbking.com/" },
  { label: "NZBStars", url: "https://nzbstars.com/" },
  { label: "NZBIndex", url: "https://nzbindex.com/search" },
  { label: "Binsearch", url: "https://www.binsearch.info/" },
] as const;

interface Limits {
  manualUsed: number;
  manualMax: number;
  downloadUsed: number;
  downloadMax: number;
}

interface Props {
  limits: Limits;
}

export default function UploadNzbView({ limits }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);

  async function submit() {
    if (!file && !url.trim()) {
      toast.error("Choose an NZB file or paste a direct NZB URL");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (url.trim()) form.append("url", url.trim());
      if (title.trim()) form.append("title", title.trim());
      if (password.trim()) form.append("password", password.trim());

      const res = await fetch("/api/grabs/manual", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string; title?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success(`Queued: ${data.title ?? "NZB"}`);
      setFile(null);
      setUrl("");
      setTitle("");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-2 sm:px-4 pb-10 space-y-8">
      <header className="text-center space-y-2 pt-2">
        <h1 className="text-2xl font-semibold flex items-center justify-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Upload NZB
        </h1>
        {(limits.manualMax > 0 || limits.downloadMax > 0) && (
          <p className="text-xs text-muted-foreground">
            {limits.manualMax > 0 && (
              <span>
                Manual uploads today: {limits.manualUsed}/{limits.manualMax}
              </span>
            )}
            {limits.manualMax > 0 && limits.downloadMax > 0 && " · "}
            {limits.downloadMax > 0 && (
              <span>
                Downloads today: {limits.downloadUsed}/{limits.downloadMax}
              </span>
            )}
          </p>
        )}
      </header>

      <div className="nv-card p-5 space-y-3 text-center">
        <h2 className="text-sm font-semibold">Where to find NZBs?</h2>
        <p className="text-xs text-muted-foreground max-w-lg mx-auto">
          These four sites are &quot;well known&quot; — you may find a lot, but that does not mean
          content is safe. <strong className="text-foreground">No guarantee at all.</strong>
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {NZB_SITES.map((site) => (
            <a
              key={site.url}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors"
            >
              {site.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-stretch">
        <div className="nv-card p-5 space-y-5 text-sm flex flex-col">
          <h2 className="text-base font-semibold text-center md:text-left">
            Tipps und Tricks für bessere Suchergebnisse
          </h2>

          <section className="space-y-2">
            <h3 className="font-medium">Suche nach Inhalten in deutscher Sprache:</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Egal ob du nach einem Video, Programm oder eBook suchst – vor allem uk casinos not on
              gamstop und die Sprache sind dabei relevant. Du kannst bei NZBIndex und Co. ganz
              einfach nach Inhalten auf Deutsch suchen indem du den Begriff „german“ bei der
              Suchanfrage anhängst.
            </p>
            <p className="text-muted-foreground text-sm">
              Beispiel: „Videoname german“
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">Suche nach den neuesten Inhalten:</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Die Seite Xrel.to listet alle möglichen Inhalte auf, die diverse Gruppen
              veröffentlicht haben. Du kannst diese Release-Namen kopieren und in einer Usenet
              Suchmaschine suchen.
            </p>
            <p className="text-muted-foreground text-sm font-mono text-xs leading-relaxed break-all">
              Beispiel: „********.2019.German.DL.AC3.Dubbed.720p.BluRay.x264-***“
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">Spam &amp; Viren vermeiden:</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Setze bei der Suchmaschine deiner Wahl immer die Mindestgröße des Inhaltes. Zum
              Beispiel bei Videos mindestens 100-500 MB, bei Musiktiteln mindestens 3 MB. So
              filterst du den größten Teil der Spam-Posts bereits raus.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">Passwortgeschützte oder nicht vollständige Inhalte:</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Achte bei den Suchergebnissen darauf, dass die Inhalte vollständig vorhanden sind.
              Bei NZBindex siehst du das bei der Information: parts available: 20 / 20
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Bei Binsearch kannst du es an dem Balken mit der Prozentzahl ablesen.
            </p>
          </section>
        </div>

        <div className="nv-card p-5 space-y-4 flex flex-col">
          <div className="text-center md:text-left">
            <h2 className="text-base font-semibold">Upload NZB or link</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Appears under Grabs — private by default. Downloads count toward your limit.
            </p>
          </div>

          <div className="space-y-3 flex-1">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">NZB file</label>
              <input
                type="file"
                accept=".nzb,application/xml,text/xml"
                className="nv-input w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} ({formatBytes(file.size)})
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Or direct NZB URL</label>
              <input
                className="nv-input w-full font-mono text-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Title (optional)</label>
                <input
                  className="nv-input w-full text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Auto from NZB"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Password (optional)</label>
                <input
                  className="nv-input w-full text-sm"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={uploading || (!file && !url.trim())}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium mt-auto",
              "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
            )}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Queue download
          </button>
        </div>
      </div>
    </div>
  );
}
