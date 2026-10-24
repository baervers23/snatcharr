"use client";

import { cn, formatBytes } from "@/lib/utils";
import {
  DEFAULT_UPLOAD_NZB_SITES,
  DEFAULT_UPLOAD_NZB_TIPS,
  type UploadNzbSite,
  type UploadNzbTip,
} from "@/lib/db/settings-shared";
import { useT } from "@/lib/i18n/client";
import { ExternalLink, Loader2, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Limits {
  manualUsed: number;
  manualMax: number;
  downloadUsed: number;
  downloadMax: number;
}

interface UploadPageContent {
  sitesHeading: string;
  sitesIntro: string;
  sites: UploadNzbSite[];
  tipsHeading: string;
  tips: UploadNzbTip[];
}

interface Props {
  limits: Limits;
  isAdmin: boolean;
  content: UploadPageContent;
}

export default function UploadNzbView({ limits, isAdmin, content: initial }: Props) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [content, setContent] = useState<UploadPageContent>(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UploadPageContent>(initial);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!file && !url.trim()) {
      toast.error(t("upload.chooseFileOrUrl"));
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
      if (!res.ok) throw new Error(data.error ?? t("upload.failed"));
      toast.success(`${t("upload.queued")}: ${data.title ?? "NZB"}`);
      setFile(null);
      setUrl("");
      setTitle("");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("upload.failed"));
    } finally {
      setUploading(false);
    }
  }

  function startEdit() {
    setDraft({
      sitesHeading: content.sitesHeading,
      sitesIntro: content.sitesIntro,
      sites: content.sites.map((s) => ({ ...s })),
      tipsHeading: content.tipsHeading,
      tips: content.tips.map((tip) => ({ ...tip })),
    });
    setEditing(true);
  }

  async function saveContent() {
    setSaving(true);
    try {
      const sites = draft.sites
        .map((s) => ({ label: s.label.trim(), url: s.url.trim() }))
        .filter((s) => s.label && s.url);
      const tips = draft.tips
        .map((tip) => ({ title: tip.title.trim(), body: tip.body.trim() }))
        .filter((tip) => tip.title && tip.body);

      const payload = {
        uploadNzbSitesHeading: draft.sitesHeading.trim() || "Where to find NZBs?",
        uploadNzbSitesIntro: draft.sitesIntro.trim(),
        uploadNzbSites: sites.length ? sites : DEFAULT_UPLOAD_NZB_SITES,
        uploadNzbTipsHeading: draft.tipsHeading.trim() || "Tips for better search results",
        uploadNzbTips: tips.length ? tips : DEFAULT_UPLOAD_NZB_TIPS,
      };
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? t("upload.saveFailed"));
      setContent({
        sitesHeading: payload.uploadNzbSitesHeading,
        sitesIntro: payload.uploadNzbSitesIntro,
        sites: payload.uploadNzbSites,
        tipsHeading: payload.uploadNzbTipsHeading,
        tips: payload.uploadNzbTips,
      });
      setEditing(false);
      toast.success(t("upload.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("upload.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const display = editing ? draft : content;

  return (
    <div className="max-w-4xl mx-auto w-full px-2 sm:px-4 pb-10 space-y-8">
      <header className="text-center space-y-2 pt-2 relative">
        <h1 className="text-2xl font-semibold flex items-center justify-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          {t("upload.title")}
        </h1>
        {(limits.manualMax > 0 || limits.downloadMax > 0) && (
          <p className="text-xs text-muted-foreground">
            {limits.manualMax > 0 && (
              <span>
                {t("upload.manualToday")}: {limits.manualUsed}/{limits.manualMax}
              </span>
            )}
            {limits.manualMax > 0 && limits.downloadMax > 0 && " · "}
            {limits.downloadMax > 0 && (
              <span>
                {t("upload.downloadsToday")}: {limits.downloadUsed}/{limits.downloadMax}
              </span>
            )}
          </p>
        )}
        {isAdmin && (
          <div className="absolute right-0 top-0 flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5" />
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveContent()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {t("common.save")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("upload.editPage")}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="nv-card p-5 space-y-3 text-center">
        {editing ? (
          <div className="space-y-3 text-left">
            <input
              className="nv-input w-full font-semibold"
              value={draft.sitesHeading}
              onChange={(e) => setDraft({ ...draft, sitesHeading: e.target.value })}
              placeholder={t("upload.sitesHeading")}
            />
            <textarea
              className="nv-input w-full min-h-20 resize-y text-sm"
              value={draft.sitesIntro}
              onChange={(e) => setDraft({ ...draft, sitesIntro: e.target.value })}
            />
            <div className="space-y-2">
              {draft.sites.map((site, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="nv-input w-32 shrink-0"
                    value={site.label}
                    onChange={(e) => {
                      const sites = [...draft.sites];
                      sites[i] = { ...sites[i], label: e.target.value };
                      setDraft({ ...draft, sites });
                    }}
                    placeholder={t("upload.siteLabel")}
                  />
                  <input
                    className="nv-input flex-1 font-mono text-xs"
                    value={site.url}
                    onChange={(e) => {
                      const sites = [...draft.sites];
                      sites[i] = { ...sites[i], url: e.target.value };
                      setDraft({ ...draft, sites });
                    }}
                    placeholder="https://"
                  />
                  <button
                    type="button"
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                    onClick={() =>
                      setDraft({ ...draft, sites: draft.sites.filter((_, j) => j !== i) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() =>
                  setDraft({ ...draft, sites: [...draft.sites, { label: "", url: "" }] })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {t("upload.addSite")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold">{display.sitesHeading}</h2>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto whitespace-pre-wrap">
              {display.sitesIntro}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {display.sites.map((site) => (
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
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-stretch">
        <div className="nv-card p-5 space-y-5 text-sm flex flex-col">
          {editing ? (
            <div className="space-y-4">
              <input
                className="nv-input w-full font-semibold"
                value={draft.tipsHeading}
                onChange={(e) => setDraft({ ...draft, tipsHeading: e.target.value })}
              />
              {draft.tips.map((tip, i) => (
                <div key={i} className="space-y-2 border border-border rounded-md p-3">
                  <div className="flex gap-2">
                    <input
                      className="nv-input flex-1"
                      value={tip.title}
                      onChange={(e) => {
                        const tips = [...draft.tips];
                        tips[i] = { ...tips[i], title: e.target.value };
                        setDraft({ ...draft, tips });
                      }}
                      placeholder={t("upload.tipTitle")}
                    />
                    <button
                      type="button"
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                      onClick={() =>
                        setDraft({ ...draft, tips: draft.tips.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    className="nv-input w-full min-h-24 resize-y text-sm"
                    value={tip.body}
                    onChange={(e) => {
                      const tips = [...draft.tips];
                      tips[i] = { ...tips[i], body: e.target.value };
                      setDraft({ ...draft, tips });
                    }}
                    placeholder={t("upload.tipBody")}
                  />
                </div>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() =>
                  setDraft({ ...draft, tips: [...draft.tips, { title: "", body: "" }] })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {t("upload.addTip")}
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-center md:text-left">
                {display.tipsHeading}
              </h2>
              {display.tips.map((tip) => (
                <section key={tip.title} className="space-y-2">
                  <h3 className="font-medium">{tip.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {tip.body}
                  </p>
                </section>
              ))}
            </>
          )}
        </div>

        <div className="nv-card p-5 space-y-4 flex flex-col">
          <div className="text-center md:text-left">
            <h2 className="text-base font-semibold">{t("upload.formHeading")}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t("upload.formHint")}</p>
          </div>

          <div className="space-y-3 flex-1">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("upload.nzbFile")}</label>
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
              <label className="text-xs text-muted-foreground">{t("upload.orUrl")}</label>
              <input
                className="nv-input w-full font-mono text-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("upload.titleOptional")}</label>
                <input
                  className="nv-input w-full text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("upload.titlePlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("upload.passwordOptional")}</label>
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
            {t("upload.queue")}
          </button>
        </div>
      </div>
    </div>
  );
}
