"use client";

import type { DownloadClient, ExternalApp, Indexer } from "@/lib/db/schema";
import type { ApiKeyMasked } from "@/lib/mask-secrets";
import {
  DEFAULT_GRAB_EXTENSION_LIMITS,
  type AppSettings,
  type ExtensionSizeLimit,
} from "@/lib/db/settings-shared";
import { defaultServiceUrl } from "@/lib/service-urls";
import {
  ADDITIONAL_APP_TYPES,
  additionalAppMeta,
  type AdditionalAppType,
} from "@/lib/additional-app-types";
import { cn, CATEGORY_GROUPS } from "@/lib/utils";
import { CheckCircle2, Download, Edit2, Info, Layers, Loader2, Mail, Plus, Save, Search, Settings, Shield, Trash2, X, XCircle } from "lucide-react";
import { GRAB_EMAIL_VARIABLES } from "@/lib/email-template";
import { canEnforceRequireEmailFromConfig } from "@/lib/email-requirements";
import {
  DEFAULT_PROWLARR_SEARCH_TAGS,
  formatProwlarrTagsInput,
  parseProwlarrTagsJson,
} from "@/lib/prowlarr-tags";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

type SettingsTab = "general" | "email" | "search" | "security" | "indexers" | "clients" | "apps";

const TABS: Array<{ id: SettingsTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "general", labelKey: "settings.tabs.general", icon: Settings },
  { id: "email", labelKey: "settings.tabs.email", icon: Mail },
  { id: "search", labelKey: "settings.tabs.search", icon: Search },
  { id: "security", labelKey: "settings.tabs.security", icon: Shield },
  { id: "indexers", labelKey: "settings.tabs.indexers", icon: Layers },
  { id: "clients", labelKey: "settings.tabs.clients", icon: Download },
  { id: "apps", labelKey: "settings.tabs.apps", icon: Layers },
];

async function testConnection(
  type: string,
  url: string,
  apiKey: string,
  fallbackError: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", type, url, apiKey }),
    });
    const d = (await r.json()) as { success?: boolean; error?: string };
    if (r.ok && d.success) return { ok: true };
    return { ok: false, error: d.error ?? fallbackError };
  } catch {
    return { ok: false, error: fallbackError };
  }
}

function CodeText({ text, codeClassName }: { text: string; codeClassName?: string }) {
  return (
    <>
      {text.split("`").map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className={codeClassName}>
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

type MaskedIndexer = ApiKeyMasked<Indexer>;
type MaskedDownloadClient = ApiKeyMasked<DownloadClient>;
type MaskedExternalApp = ApiKeyMasked<ExternalApp>;

interface Props {
  settings: Partial<AppSettings>;
  indexers: MaskedIndexer[];
  downloadClients: MaskedDownloadClient[];
  externalApps: MaskedExternalApp[];
}

function tabFromParam(param: string | null): SettingsTab {
  if (param && TABS.some((t) => t.id === param)) return param as SettingsTab;
  return "general";
}

export default function SettingsView({ settings: initialSettings, indexers: initialIndexers, downloadClients: initialClients, externalApps: initialApps }: Props) {
  const t = useT();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => tabFromParam(searchParams.get("tab")));
  const [settings, setSettings] = useState(initialSettings);
  const [indexers, setIndexers] = useState(initialIndexers);
  const [clients, setClients] = useState(initialClients);
  const [apps, setApps] = useState(initialApps);
  const [saving, setSaving] = useState(false);

  async function saveSettings(partial: Partial<AppSettings>) {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? t("settings.saveFailed"));
      setSettings((prev) => ({
        ...prev,
        ...partial,
        ...(partial.smtpPassword !== undefined ? { smtpPassword: "***" } : {}),
      }));
      toast.success(t("settings.saved"));
      const languageChanged =
        partial.uiLanguage !== undefined &&
        partial.uiLanguage !== (settings.uiLanguage ?? "en");
      if (languageChanged) {
        window.location.reload();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        {t("nav.settings")}
      </h1>

      <div className="flex gap-6">
        {/* Tab sidebar */}
        <nav className="w-48 shrink-0 space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {activeTab === "general" && (
            <GeneralTab settings={settings} apps={apps} onSave={saveSettings} saving={saving} />
          )}
          {activeTab === "email" && (
            <EmailTab settings={settings} onSave={saveSettings} saving={saving} />
          )}
          {activeTab === "search" && (
            <SearchSettingsTab settings={settings} onSave={saveSettings} saving={saving} />
          )}
          {activeTab === "security" && (
            <SecurityTab settings={settings} onSave={saveSettings} saving={saving} apps={apps} />
          )}
          {activeTab === "indexers" && (
            <IndexersTab indexers={indexers} onRefresh={async () => {
              const r = await fetch("/api/indexers");
              const d = await r.json() as { indexers: MaskedIndexer[] };
              setIndexers(d.indexers ?? []);
            }} />
          )}
          {activeTab === "clients" && (
            <ClientsTab clients={clients} onRefresh={async () => {
              const r = await fetch("/api/download-clients");
              const d = await r.json() as { clients: MaskedDownloadClient[] };
              setClients(d.clients ?? []);
            }} />
          )}
          {activeTab === "apps" && (
            <AppsTab apps={apps} onRefresh={async () => {
              const r = await fetch("/api/apps");
              const d = await r.json() as { apps: MaskedExternalApp[] };
              setApps(d.apps ?? []);
            }} />
          )}
        </div>
      </div>
    </div>
  );
}


function GeneralTab({
  settings,
  apps,
  onSave,
  saving,
}: {
  settings: Partial<AppSettings>;
  apps: MaskedExternalApp[];
  onSave: (s: Partial<AppSettings>) => void;
  saving: boolean;
}) {
  const t = useT();
  const emailEnforce = canEnforceRequireEmailFromConfig(settings, apps);
  const [form, setForm] = useState({
    logLevel: settings.logLevel ?? "info",
    completedGrabKeepDays: settings.completedGrabKeepDays ?? 7,
    infoPopupMode: settings.infoPopupMode ?? (settings.infoPopupEnabled ? "always" : "disabled"),
    infoPopupTitle: settings.infoPopupTitle ?? "",
    infoPopupText: settings.infoPopupText ?? "",
    uiLanguage: settings.uiLanguage ?? "en",
    signupEnabled: settings.signupEnabled ?? false,
    requireEmail: settings.requireEmail ?? false,
    requireAppGrant: settings.requireAppGrant ?? false,
    requireUploadGrant: settings.requireUploadGrant ?? false,
    allowPickDownloader: settings.allowPickDownloader ?? false,
    forgotPasswordUrl: settings.forgotPasswordUrl ?? "",
  });

  return (
    <div className="space-y-4">
      <div className="nv-card p-5 space-y-5">
        <h2 className="text-base font-semibold">{t("settings.general.heading")}</h2>

        <FieldRow
          label={t("settings.general.language")}
          description={t("settings.general.languageDescription")}
        >
          <select
            className="nv-input w-full max-w-xs"
            value={form.uiLanguage}
            onChange={(e) => setForm({ ...form, uiLanguage: e.target.value })}
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.label}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow
          label={t("settings.general.signup")}
          description={t("settings.general.signupDesc")}
        >
          <Toggle checked={form.signupEnabled} onChange={(v) => setForm({ ...form, signupEnabled: v })} />
        </FieldRow>

        <FieldRow label={t("settings.general.requireEmail")} description={t("settings.general.requireEmailDesc")}>
          <Toggle checked={form.requireEmail} onChange={(v) => setForm({ ...form, requireEmail: v })} />
        </FieldRow>
        {form.requireEmail && !emailEnforce.allowed && (
          <p className="text-xs text-amber-400/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            {t("settings.general.emailNotEnforced")}
          </p>
        )}

        <FieldRow
          label={t("settings.general.appGrant")}
          description={t("settings.general.appGrantDesc")}
        >
          <Toggle checked={form.requireAppGrant} onChange={(v) => setForm({ ...form, requireAppGrant: v })} />
        </FieldRow>

        <FieldRow
          label={t("settings.general.uploadGrant")}
          description={t("settings.general.uploadGrantDesc")}
        >
          <Toggle checked={form.requireUploadGrant} onChange={(v) => setForm({ ...form, requireUploadGrant: v })} />
        </FieldRow>

        <FieldRow
          label={t("settings.general.pickDownloader")}
          description={t("settings.general.pickDownloaderDesc")}
        >
          <Toggle
            checked={form.allowPickDownloader}
            onChange={(v) => setForm({ ...form, allowPickDownloader: v })}
          />
        </FieldRow>

        <FieldRow
          label={t("settings.general.forgotPasswordUrl")}
          description={t("settings.general.forgotPasswordUrlDesc")}
        >
          <input
            className="nv-input w-full max-w-md"
            type="url"
            value={form.forgotPasswordUrl}
            onChange={(e) => setForm({ ...form, forgotPasswordUrl: e.target.value })}
            placeholder="https://jellyfin.example.com/web/index.html#!/forgotpassword.html"
          />
        </FieldRow>

        <div className="border-t border-border pt-4" />

        <FieldRow label={t("settings.general.logLevel")} description={t("settings.general.logLevelDesc")}>
          <select className="nv-input w-32" value={form.logLevel} onChange={(e) => setForm({ ...form, logLevel: e.target.value as AppSettings["logLevel"] })}>
            <option value="debug">{t("settings.general.logLevels.debug")}</option>
            <option value="info">{t("settings.general.logLevels.info")}</option>
            <option value="warn">{t("settings.general.logLevels.warn")}</option>
            <option value="error">{t("settings.general.logLevels.error")}</option>
          </select>
        </FieldRow>

        <FieldRow label={t("settings.general.keepGrabs")} description={t("settings.general.keepGrabsDesc")}>
          <input className="nv-input w-32" type="number" min={0} value={form.completedGrabKeepDays} onChange={(e) => setForm({ ...form, completedGrabKeepDays: parseInt(e.target.value) || 0 })} />
        </FieldRow>

        <div className="border-t border-border pt-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("settings.general.disclaimerHeading")}</h3>
          <FieldRow label={t("settings.general.disclaimerShow")} description={t("settings.general.disclaimerShowDesc")}>
            <select
              className="nv-input w-full max-w-xs"
              value={form.infoPopupMode}
              onChange={(e) =>
                setForm({
                  ...form,
                  infoPopupMode: e.target.value as AppSettings["infoPopupMode"],
                })
              }
            >
              <option value="once">{t("settings.general.disclaimerOnce")}</option>
              <option value="always">{t("settings.general.disclaimerAlways")}</option>
              <option value="disabled">{t("settings.general.disclaimerDisabled")}</option>
            </select>
          </FieldRow>
          {form.infoPopupMode !== "disabled" && (
            <>
              <FieldRow
                label={t("settings.general.noticeTitle")}
                description={t("settings.general.noticeTitleDescription")}
              >
                <input
                  className="nv-input w-full max-w-md"
                  type="text"
                  value={form.infoPopupTitle}
                  onChange={(e) => setForm({ ...form, infoPopupTitle: e.target.value })}
                  placeholder={t("settings.general.noticeTitlePlaceholder")}
                />
              </FieldRow>
              <textarea
                className="nv-input w-full min-h-24 resize-y"
                placeholder={t("settings.general.disclaimerTextPlaceholder")}
                value={form.infoPopupText}
                onChange={(e) => setForm({ ...form, infoPopupText: e.target.value })}
              />
            </>
          )}
        </div>

        <SaveBar
          saving={saving}
          onSave={() =>
            onSave({
              logLevel: form.logLevel,
              completedGrabKeepDays: form.completedGrabKeepDays,
              infoPopupMode: form.infoPopupMode,
              infoPopupTitle: form.infoPopupTitle.trim(),
              infoPopupText: form.infoPopupText,
              uiLanguage: form.uiLanguage,
              signupEnabled: form.signupEnabled,
              requireEmail: form.requireEmail,
              requireAppGrant: form.requireAppGrant,
              requireUploadGrant: form.requireUploadGrant,
              allowPickDownloader: form.allowPickDownloader,
              forgotPasswordUrl: form.forgotPasswordUrl.trim(),
            })
          }
        />
      </div>
    </div>
  );
}

function EmailTab({ settings, onSave, saving }: { settings: Partial<AppSettings>; onSave: (s: Partial<AppSettings>) => void; saving: boolean }) {
  const t = useT();
  const [form, setForm] = useState({
    hostUrl: settings.hostUrl ?? "http://localhost:3000",
    smtpHost: settings.smtpHost ?? "",
    smtpPort: settings.smtpPort ?? 587,
    smtpUser: settings.smtpUser ?? "",
    smtpPassword: settings.smtpPassword ? (settings.smtpPassword === "***" ? "" : settings.smtpPassword) : "",
    smtpFrom: settings.smtpFrom ?? "snatcharr@localhost",
    smtpPasswordSet: !!settings.smtpPassword,
    grabEmailSubject: settings.grabEmailSubject ?? "[$instance] Download ready: $requestedgrab",
    grabEmailBody:
      settings.grabEmailBody ??
      "Hi $user,\n\nYour download **$requestedgrab** ($size) is ready.\n\n$passwordblock\nBrowse or download your files here: $grablink",
  });
  const [testEmail, setTestEmail] = useState("");
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  function insertVariable(key: string) {
    setForm((f) => ({ ...f, grabEmailBody: `${f.grabEmailBody}${f.grabEmailBody.endsWith("\n") || !f.grabEmailBody ? "" : " "}${key}` }));
  }

  async function testSmtp() {
    setTestingSmtp(true);
    try {
      const response = await fetch("/api/settings/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(testEmail.trim() ? { to: testEmail.trim() } : {}),
          smtpHost: form.smtpHost,
          smtpPort: form.smtpPort,
          smtpUser: form.smtpUser,
          smtpPassword: form.smtpPassword || (form.smtpPasswordSet ? "***" : ""),
          smtpFrom: form.smtpFrom,
        }),
      });
      const data = (await response.json()) as { error?: string; to?: string };
      if (!response.ok) throw new Error(data.error ?? t("settings.email.testFailed"));
      toast.success(t("settings.email.testSent", { to: data.to ?? "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.email.testFailed"));
    } finally {
      setTestingSmtp(false);
    }
  }

  async function saveEmail() {
    const payload: Partial<AppSettings> = {
      hostUrl: form.hostUrl.trim(),
      smtpHost: form.smtpHost,
      smtpPort: form.smtpPort,
      smtpUser: form.smtpUser,
      smtpFrom: form.smtpFrom,
      grabEmailSubject: form.grabEmailSubject,
      grabEmailBody: form.grabEmailBody,
    };
    if (form.smtpPassword) payload.smtpPassword = form.smtpPassword;
    await onSave(payload);
    if (form.smtpPassword) {
      setForm((f) => ({ ...f, smtpPassword: "", smtpPasswordSet: true }));
    }
  }

  const previewGrabLink = `${form.hostUrl.replace(/\/$/, "") || "https://snatcharr.example"}/grabs`;
  const previewBody = form.grabEmailBody
    .replace(/\$user/g, "alice")
    .replace(/\$requestedgrab/g, "Movie.2024.1080p.mkv")
    .replace(/\$grablink|\$link/g, previewGrabLink)
    .replace(/\$size/g, "4.2 GB")
    .replace(/\$instance/g, "Snatcharr")
    .replace(/\$passwordblock/g, "Archive password: **secret123**\nA copy is also saved as password.txt in your download folder.")
    .replace(/\$password/g, "secret123");

  return (
    <div className="space-y-4">
      <div className="nv-card p-5 space-y-5">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          {t("settings.email.smtp")}
        </h2>
        <p className="text-xs text-muted-foreground">
          <CodeText text={t("settings.email.smtpHint")} codeClassName="font-mono text-[11px]" />
        </p>

        <FieldRow label={t("settings.email.smtpHost")}>
          <input className="nv-input w-full max-w-md" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} placeholder="smtp.example.com" />
        </FieldRow>
        <FieldRow label={t("settings.email.smtpPort")}>
          <input className="nv-input w-32" type="number" min={1} max={65535} value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 587 })} />
        </FieldRow>
        <FieldRow label={t("settings.email.smtpUser")}>
          <input className="nv-input w-full max-w-md" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} autoComplete="off" />
        </FieldRow>
        <FieldRow label={t("settings.email.smtpPassword")} description={form.smtpPasswordSet && !form.smtpPassword ? t("settings.email.smtpPasswordSaved") : undefined}>
          <input className="nv-input w-full max-w-md" type="password" value={form.smtpPassword} onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })} placeholder={form.smtpPasswordSet ? "••••••••" : ""} autoComplete="new-password" />
        </FieldRow>
        <FieldRow label={t("settings.email.fromAddress")}>
          <input className="nv-input w-full max-w-md" type="email" value={form.smtpFrom} onChange={(e) => setForm({ ...form, smtpFrom: e.target.value })} />
        </FieldRow>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">{t("settings.email.testRecipient")}</label>
            <input className="nv-input w-full" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder={t("settings.email.testRecipientPlaceholder")} />
          </div>
          <button type="button" onClick={testSmtp} disabled={testingSmtp || !form.smtpHost.trim()} className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent disabled:opacity-50 shrink-0">
            {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {t("settings.email.sendTest")}
          </button>
        </div>
      </div>

      <div className="nv-card p-5 space-y-4">
        <h2 className="text-base font-semibold">{t("settings.email.grabNotification")}</h2>
        <FieldRow
          label={t("settings.email.publicUrl")}
          description={t("settings.email.publicUrlDesc")}
        >
          <input
            className="nv-input w-full max-w-md font-mono"
            value={form.hostUrl}
            onChange={(e) => setForm({ ...form, hostUrl: e.target.value })}
            placeholder="https://snatcharr.example.com"
          />
        </FieldRow>
        <p className="text-xs text-muted-foreground">
          <CodeText text={t("settings.email.markdownHint")} codeClassName="font-mono" />
        </p>
        <div className="flex flex-wrap gap-2">
          {GRAB_EMAIL_VARIABLES.map((v) => (
            <button key={v.key} type="button" onClick={() => insertVariable(v.key)} className="px-2 py-1 text-xs rounded-md border border-border hover:bg-accent font-mono">
              {v.key}
            </button>
          ))}
        </div>

        <FieldRow label={t("settings.email.subject")}>
          <input className="nv-input w-full" value={form.grabEmailSubject} onChange={(e) => setForm({ ...form, grabEmailSubject: e.target.value })} />
        </FieldRow>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("settings.email.message")}</label>
          <textarea
            className="nv-input w-full min-h-40 resize-y font-mono text-sm"
            value={form.grabEmailBody}
            onChange={(e) => setForm({ ...form, grabEmailBody: e.target.value })}
          />
        </div>

        <button type="button" onClick={() => setShowPreview(!showPreview)} className="text-xs text-primary hover:underline">
          {showPreview ? t("settings.email.hidePreview") : t("settings.email.showPreview")}
        </button>
        {showPreview && (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap">{previewBody}</div>
        )}

        <SaveBar saving={saving} onSave={saveEmail} />
      </div>
    </div>
  );
}

function SearchSettingsTab({ settings, onSave, saving }: { settings: Partial<AppSettings>; onSave: (s: Partial<AppSettings>) => void; saving: boolean }) {
  const t = useT();
  const [form, setForm] = useState({
    maxResults: settings.maxResults ?? 100,
    maxSearchRequestsPerUserPerDay: settings.maxSearchRequestsPerUserPerDay ?? 0,
    searchRateLimitPerMinute: settings.searchRateLimitPerMinute ?? 30,
    enabledCategories: settings.enabledCategories ?? CATEGORY_GROUPS.map((g) => g.label),
  });

  function toggleCategory(label: string) {
    setForm((f) => ({
      ...f,
      enabledCategories: f.enabledCategories.includes(label)
        ? f.enabledCategories.filter((c) => c !== label)
        : [...f.enabledCategories, label],
    }));
  }

  return (
    <div className="nv-card p-5 space-y-5">
      <h2 className="text-base font-semibold">{t("settings.search.heading")}</h2>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("settings.search.groupResults")}
        </h3>
        <FieldRow label={t("settings.search.resultsPerPage")} description={t("settings.search.resultsPerPageDesc")}>
          <input
            className="nv-input w-32"
            type="number"
            min={10}
            max={500}
            value={form.maxResults}
            onChange={(e) => setForm({ ...form, maxResults: parseInt(e.target.value) })}
          />
        </FieldRow>
      </section>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("settings.search.groupLimits")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("settings.search.groupLimitsDesc")}</p>
        <FieldRow label={t("settings.search.searchPerDay")} description={t("settings.search.searchPerDayDesc")}>
          <input
            className="nv-input w-32"
            type="number"
            min={0}
            value={form.maxSearchRequestsPerUserPerDay}
            onChange={(e) =>
              setForm({ ...form, maxSearchRequestsPerUserPerDay: parseInt(e.target.value) || 0 })
            }
          />
        </FieldRow>
        <FieldRow label={t("settings.search.searchPerMinute")} description={t("settings.search.searchPerMinuteDesc")}>
          <input
            className="nv-input w-32"
            type="number"
            min={0}
            value={form.searchRateLimitPerMinute}
            onChange={(e) =>
              setForm({ ...form, searchRateLimitPerMinute: parseInt(e.target.value) || 0 })
            }
          />
        </FieldRow>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("settings.search.groupCategories")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("settings.search.groupCategoriesDesc")}</p>
        <div className="space-y-2">
          {CATEGORY_GROUPS.map((g) => {
            const on = form.enabledCategories.includes(g.label);
            return (
              <div key={g.label} className="flex items-center justify-between gap-3">
                <span className="text-sm">{g.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => toggleCategory(g.label)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                    on ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      on ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <SaveBar saving={saving} onSave={() => onSave(form)} />
    </div>
  );
}


const AUTH_METHODS: AppSettings["authMethod"][] = [
  "local",
  "jellyfin",
  "organizr",
  "organizr-sso",
  "jfago",
  "seerr",
  "seerr-local",
  "seerr-jellyfin",
  "seerr-jellyfin-fallback",
];

function mbFromBytes(bytes: number): number | "" {
  if (!bytes || bytes <= 0) return "";
  return Math.round(bytes / 1024 / 1024);
}

function bytesFromMb(mb: number): number {
  return mb > 0 ? mb * 1024 * 1024 : 0;
}

function GrabExtensionLimitsEditor({
  rows,
  onChange,
}: {
  rows: ExtensionSizeLimit[];
  onChange: (rows: ExtensionSizeLimit[]) => void;
}) {
  const t = useT();
  function updateRow(index: number, patch: Partial<ExtensionSizeLimit>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const compactInput =
    "h-7 w-20 min-w-[4.5rem] px-2 text-xs font-mono tabular-nums text-center bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-2 w-full">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium w-20">{t("settings.security.extensionTable.ext")}</th>
              <th className="px-2 py-1.5 text-center font-medium w-24">{t("settings.security.extensionTable.min")}</th>
              <th className="px-1 py-1.5 text-center font-medium w-4" />
              <th className="px-2 py-1.5 text-center font-medium w-24">{t("settings.security.extensionTable.max")}</th>
              <th className="px-2 py-1.5 text-left font-medium w-8">{t("settings.security.extensionTable.unit")}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.ext}-${index}`} className="border-b border-border/60 last:border-0">
                <td className="px-2 py-1">
                  <input
                    className="h-7 w-full min-w-[3.5rem] px-1.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder=".mp4"
                    value={row.ext}
                    onChange={(e) => updateRow(index, { ext: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  <input
                    className={compactInput}
                    type="number"
                    min={0}
                    placeholder="—"
                    value={mbFromBytes(row.minBytes)}
                    onChange={(e) =>
                      updateRow(index, { minBytes: bytesFromMb(parseInt(e.target.value) || 0) })
                    }
                  />
                </td>
                <td className="px-1 py-1 text-center text-muted-foreground">–</td>
                <td className="px-2 py-1 text-center">
                  <input
                    className={compactInput}
                    type="number"
                    min={0}
                    placeholder="—"
                    value={mbFromBytes(row.maxBytes)}
                    onChange={(e) =>
                      updateRow(index, { maxBytes: bytesFromMb(parseInt(e.target.value) || 0) })
                    }
                  />
                </td>
                <td className="px-2 py-1 text-muted-foreground">{t("settings.security.extensionTable.unit")}</td>
                <td className="px-1 py-1 text-center">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive p-0.5"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    aria-label={t("settings.security.extensionTable.remove")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => onChange([...rows, { ext: "", minBytes: 0, maxBytes: 0 }])}
      >
        {t("settings.security.extensionTable.add")}
      </button>
    </div>
  );
}

function AuthMethodSelect({
  value,
  onChange,
  hasJellyfin,
  hasOrganizr,
  hasSeerr,
  hasJfago,
  includeNone,
}: {
  value: AppSettings["authMethod"] | "none";
  onChange: (v: AppSettings["authMethod"] | "none") => void;
  hasJellyfin: boolean;
  hasOrganizr: boolean;
  hasSeerr: boolean;
  hasJfago: boolean;
  includeNone?: boolean;
}) {
  const t = useT();
  return (
    <select
      className="nv-input w-full max-w-sm"
      value={value}
      onChange={(e) => onChange(e.target.value as AppSettings["authMethod"] | "none")}
    >
      {includeNone && <option value="none">{t("settings.security.authNone")}</option>}
      <option value="local">{t("setup.authLocal")}</option>
      <option value="jellyfin" disabled={!hasJellyfin}>
        Jellyfin{hasJellyfin ? "" : t("setup.authAddFirst", { app: "Jellyfin" })}
      </option>
      <option value="seerr-local" disabled={!hasSeerr}>
        {t("setup.seerrLocal")}
        {hasSeerr ? "" : t("setup.authAddFirst", { app: "Seerr" })}
      </option>
      <option value="seerr-jellyfin" disabled={!hasSeerr}>
        {t("setup.seerrJellyfin")}
        {hasSeerr ? "" : t("setup.authAddFirst", { app: "Seerr" })}
      </option>
      <option value="organizr" disabled={!hasOrganizr}>
        {t("settings.security.authOrganizr")}
        {hasOrganizr ? "" : t("setup.authAddFirst", { app: "Organizr" })}
      </option>
      <option value="organizr-sso" disabled={!hasOrganizr}>
        {t("settings.security.authOrganizrSso")}
        {hasOrganizr ? "" : t("setup.authAddFirst", { app: "Organizr" })}
      </option>
      <option value="jfago" disabled={!hasJfago}>
        {t("settings.security.authJfago")}
        {hasJfago ? "" : t("setup.authAddFirst", { app: "JFA-GO" })}
      </option>
    </select>
  );
}

function AuthMethodHelpModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Info className="h-5 w-5 text-primary shrink-0" />
          <h3 className="font-semibold text-foreground">{t("settings.security.authMethodsTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{t("settings.security.authMethodsHelp")}</p>
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
            {t("settings.security.authMethodsFallbackNote")}
          </p>
        </div>
      </div>
    </div>
  );
}

function SecurityTab({ settings, onSave, saving, apps }: { settings: Partial<AppSettings>; onSave: (s: Partial<AppSettings>) => void; saving: boolean; apps: MaskedExternalApp[] }) {
  const t = useT();
  const initialAuth = AUTH_METHODS.includes(settings.authMethod as AppSettings["authMethod"])
    ? settings.authMethod === "seerr-jellyfin-fallback"
      ? "seerr-jellyfin"
      : (settings.authMethod as AppSettings["authMethod"])
    : "local";
  const initialFallback =
    settings.authFallbackMethod ??
    (settings.authMethod === "seerr-jellyfin-fallback" ? "jellyfin" : "none");
  const [form, setForm] = useState({
    authMethod: initialAuth,
    authFallbackMethod: initialFallback as AppSettings["authFallbackMethod"],
    sessionTimeoutHours: settings.sessionTimeoutHours ?? 24,
    userDownloadSpeedLimitMbit: settings.userDownloadSpeedLimitMbit ?? 0,
    maxGrabsPerUserPerDay: settings.maxGrabsPerUserPerDay ?? 0,
    maxManualNzbPerUserPerDay: settings.maxManualNzbPerUserPerDay ?? 5,
    maxDownloadsPerUserPerDay: settings.maxDownloadsPerUserPerDay ?? 0,
    maxConcurrentGrabsPerUser: settings.maxConcurrentGrabsPerUser ?? 2,
    grabFilterExtensionLimitsEnabled: settings.grabFilterExtensionLimitsEnabled ?? true,
    grabFilterExtensionLimits:
      settings.grabFilterExtensionLimits?.length
        ? settings.grabFilterExtensionLimits.map((r) => ({ ...r }))
        : DEFAULT_GRAB_EXTENSION_LIMITS.map((r) => ({ ...r })),
    grabFilterTitleBlacklist: (settings.grabFilterTitleBlacklist ?? []).join("\n"),
    grabFilterDomainBlacklist: (settings.grabFilterDomainBlacklist ?? []).join("\n"),
  });
  const [showAuthHelp, setShowAuthHelp] = useState(false);

  const hasJellyfin = apps.some((a) => a.type === "jellyfin" && a.enabled);
  const hasOrganizr = apps.some((a) => a.type === "organizr" && a.enabled);
  const hasSeerr = apps.some((a) => a.type === "seerr" && a.enabled);
  const hasJfago = apps.some((a) => a.type === "jfago" && a.enabled);

  return (
    <div className="nv-card p-5 space-y-5">
      <h2 className="text-base font-semibold">{t("settings.security.heading")}</h2>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("settings.security.groupAuth")}
        </h3>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex items-center gap-1.5">
            <label className="text-sm font-medium text-foreground">
              {t("settings.security.authMethod")}
            </label>
            <button
              type="button"
              className="text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setShowAuthHelp(true)}
              aria-label={t("settings.security.authHelp")}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <AuthMethodSelect
            value={form.authMethod}
            onChange={(authMethod) =>
              setForm({
                ...form,
                authMethod: authMethod === "none" ? "local" : authMethod,
              })
            }
            hasJellyfin={hasJellyfin}
            hasOrganizr={hasOrganizr}
            hasSeerr={hasSeerr}
            hasJfago={hasJfago}
          />
        </div>

        <FieldRow label={t("settings.security.fallbackMethod")}>
          <AuthMethodSelect
            value={form.authFallbackMethod}
            onChange={(authFallbackMethod) => setForm({ ...form, authFallbackMethod })}
            hasJellyfin={hasJellyfin}
            hasOrganizr={hasOrganizr}
            hasSeerr={hasSeerr}
            hasJfago={hasJfago}
            includeNone
          />
        </FieldRow>

        <FieldRow label={t("settings.security.sessionTimeout")}>
          <input
            className="nv-input w-32"
            type="number"
            min={1}
            max={720}
            value={form.sessionTimeoutHours}
            onChange={(e) => setForm({ ...form, sessionTimeoutHours: parseInt(e.target.value) })}
          />
        </FieldRow>
      </section>

      {showAuthHelp && <AuthMethodHelpModal onClose={() => setShowAuthHelp(false)} />}

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("settings.security.groupLimits")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("settings.security.groupLimitsDesc")}</p>
        <FieldRow label={t("settings.security.grabsPerDay")} description={t("settings.security.grabsPerDayDesc")}>
          <input
            className="nv-input w-32"
            type="number"
            min={0}
            value={form.maxGrabsPerUserPerDay}
            onChange={(e) => setForm({ ...form, maxGrabsPerUserPerDay: parseInt(e.target.value) || 0 })}
          />
        </FieldRow>
        <FieldRow label={t("settings.security.manualNzbPerDay")} description={t("settings.security.manualNzbPerDayDesc")}>
          <input
            className="nv-input w-32"
            type="number"
            min={0}
            value={form.maxManualNzbPerUserPerDay}
            onChange={(e) =>
              setForm({ ...form, maxManualNzbPerUserPerDay: parseInt(e.target.value) || 0 })
            }
          />
        </FieldRow>
        <FieldRow label={t("settings.security.downloadsPerDay")} description={t("settings.security.downloadsPerDayDesc")}>
          <input
            className="nv-input w-32"
            type="number"
            min={0}
            value={form.maxDownloadsPerUserPerDay}
            onChange={(e) =>
              setForm({ ...form, maxDownloadsPerUserPerDay: parseInt(e.target.value) || 0 })
            }
          />
        </FieldRow>
        <FieldRow label={t("settings.security.concurrentGrabs")} description={t("settings.security.concurrentGrabsDesc")}>
          <input
            className="nv-input w-32"
            type="number"
            min={0}
            value={form.maxConcurrentGrabsPerUser}
            onChange={(e) =>
              setForm({ ...form, maxConcurrentGrabsPerUser: parseInt(e.target.value) || 0 })
            }
          />
        </FieldRow>
        <FieldRow
          label={t("settings.security.downloadSpeedLimit")}
          description={t("settings.security.downloadSpeedLimitDescription")}
        >
          <div className="relative w-32">
            <input
              className="nv-input w-full pr-14"
              type="number"
              min={0}
              step={0.1}
              value={form.userDownloadSpeedLimitMbit}
              onChange={(e) =>
                setForm({
                  ...form,
                  userDownloadSpeedLimitMbit: Math.max(0, parseFloat(e.target.value) || 0),
                })
              }
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
              {t("settings.security.downloadSpeedUnit")}
            </span>
          </div>
        </FieldRow>
      </div>

      <div className="border-t border-border pt-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("settings.security.groupFilters")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("settings.security.groupFiltersDesc")}</p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("settings.security.titleBlacklist")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.security.titleBlacklistDesc")}</p>
            <textarea
              className="nv-input w-full min-h-[88px] font-mono text-xs"
              value={form.grabFilterTitleBlacklist}
              onChange={(e) => setForm({ ...form, grabFilterTitleBlacklist: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("settings.security.domainBlacklist")}</label>
            <p className="text-xs text-muted-foreground">{t("settings.security.domainBlacklistDesc")}</p>
            <textarea
              className="nv-input w-full min-h-[88px] font-mono text-xs"
              value={form.grabFilterDomainBlacklist}
              onChange={(e) => setForm({ ...form, grabFilterDomainBlacklist: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium">{t("settings.security.extensionLimits")}</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("settings.security.extensionLimitsDesc")}
              </p>
            </div>
            <Toggle
              checked={form.grabFilterExtensionLimitsEnabled}
              onChange={(grabFilterExtensionLimitsEnabled) =>
                setForm({ ...form, grabFilterExtensionLimitsEnabled })
              }
            />
          </div>
          {form.grabFilterExtensionLimitsEnabled && (
            <GrabExtensionLimitsEditor
              rows={form.grabFilterExtensionLimits}
              onChange={(grabFilterExtensionLimits) => setForm({ ...form, grabFilterExtensionLimits })}
            />
          )}
        </div>
      </div>

      <SaveBar
        saving={saving}
        onSave={() =>
          onSave({
            authMethod: form.authMethod,
            authFallbackMethod: form.authFallbackMethod,
            sessionTimeoutHours: form.sessionTimeoutHours,
            userDownloadSpeedLimitMbit: form.userDownloadSpeedLimitMbit,
            maxGrabsPerUserPerDay: form.maxGrabsPerUserPerDay,
            maxManualNzbPerUserPerDay: form.maxManualNzbPerUserPerDay,
            maxDownloadsPerUserPerDay: form.maxDownloadsPerUserPerDay,
            maxConcurrentGrabsPerUser: form.maxConcurrentGrabsPerUser,
            grabFilterExtensionLimitsEnabled: form.grabFilterExtensionLimitsEnabled,
            grabFilterExtensionLimits: form.grabFilterExtensionLimits
              .map((r) => ({
                ext: r.ext.trim().startsWith(".") ? r.ext.trim() : r.ext.trim() ? `.${r.ext.trim()}` : "",
                minBytes: r.minBytes,
                maxBytes: r.maxBytes,
              }))
              .filter((r) => r.ext),
            grabFilterTitleBlacklist: form.grabFilterTitleBlacklist
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            grabFilterDomainBlacklist: form.grabFilterDomainBlacklist
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      />
    </div>
  );
}


function IndexersTab({ indexers, onRefresh }: { indexers: MaskedIndexer[]; onRefresh: () => void }) {
  const t = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, "ok" | "error">>({});
  const defaultProwlarrTags = formatProwlarrTagsInput([...DEFAULT_PROWLARR_SEARCH_TAGS]);
  const [form, setForm] = useState({
    name: "Prowlarr",
    type: "prowlarr",
    url: defaultServiceUrl("prowlarr"),
    apiKey: "",
    categories: "",
    prowlarrTags: defaultProwlarrTags,
  });
  const [saving, setSaving] = useState(false);
  const [testedKey, setTestedKey] = useState<string | null>(null);
  const [testingNew, setTestingNew] = useState(false);

  const [editItem, setEditItem] = useState<MaskedIndexer | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    url: "",
    apiKey: "",
    apiKeySet: false,
    categories: "",
    prowlarrTags: defaultProwlarrTags,
    enabled: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTestedKey, setEditTestedKey] = useState<string | null>(null);
  const [testingEdit, setTestingEdit] = useState(false);

  const currentKey = `${form.url}|${form.apiKey}`;
  const isTested = testedKey === currentKey && !!form.url && !!form.apiKey;
  const editConnectionKey = `prowlarr|${editForm.url}|${editForm.apiKey}`;
  const editNeedsApiKeyTest = !!editForm.apiKey.trim();
  const editApiKeyVerified = !editNeedsApiKeyTest || editTestedKey === editConnectionKey;

  function openEdit(idx: MaskedIndexer) {
    let cats = "";
    try {
      cats = (JSON.parse(idx.categories || "[]") as number[]).join(",");
    } catch {
      cats = "";
    }
    const tags = formatProwlarrTagsInput(parseProwlarrTagsJson(idx.prowlarrTags));
    setEditForm({
      name: idx.name,
      url: idx.url,
      apiKey: "",
      apiKeySet: !!idx.apiKeySet,
      categories: cats,
      prowlarrTags: tags || defaultProwlarrTags,
      enabled: idx.enabled ?? true,
    });
    setEditTestedKey(null);
    setEditItem(idx);
  }

  async function testEdit() {
    if (!editForm.apiKey.trim() || !editForm.url) return;
    setTestingEdit(true);
    const res = await testConnection("prowlarr", editForm.url, editForm.apiKey, t("settings.connection.failedShort"));
    if (res.ok) {
      setEditTestedKey(editConnectionKey);
      toast.success(t("settings.connection.ok"));
    } else {
      setEditTestedKey(null);
      toast.error(t("settings.connection.failed", { error: res.error ?? "" }));
    }
    setTestingEdit(false);
  }

  async function saveEdit() {
    if (!editItem) return;
    if (!editApiKeyVerified) {
      toast.error(t("settings.connection.testNewKey"));
      return;
    }
    setSavingEdit(true);
    try {
      const { apiKey, apiKeySet: _apiKeySet, ...rest } = editForm;
      const r = await fetch(`/api/indexers/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      if (!r.ok) throw new Error();
      toast.success(t("settings.indexers.updated"));
      setEditItem(null);
      onRefresh();
    } catch {
      toast.error(t("settings.indexers.updateFailed"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function testNew() {
    setTestingNew(true);
    const res = await testConnection(form.type, form.url, form.apiKey, t("settings.connection.failedShort"));
    if (res.ok) {
      setTestedKey(currentKey);
      toast.success(t("settings.connection.ok"));
    } else {
      setTestedKey(null);
      toast.error(t("settings.connection.failed", { error: res.error ?? "" }));
    }
    setTestingNew(false);
  }

  async function addIndexer() {
    setSaving(true);
    try {
      const response = await fetch("/api/indexers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error();
      toast.success(t("settings.indexers.added"));
      setShowAdd(false);
      setForm({
        name: "Prowlarr",
        type: "prowlarr",
        url: defaultServiceUrl("prowlarr"),
        apiKey: "",
        categories: "",
        prowlarrTags: defaultProwlarrTags,
      });
      setTestedKey(null);
      onRefresh();
    } catch {
      toast.error(t("settings.indexers.addFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function testIndexer(id: string) {
    setTesting(id);
    try {
      const response = await fetch(`/api/indexers/${id}/test`, { method: "POST" });
      const data = await response.json() as { ok: boolean; version?: string; error?: string };
      setStatusMap((m) => ({ ...m, [id]: data.ok ? "ok" : "error" }));
      if (data.ok) {
        toast.success(
          data.version
            ? t("settings.connection.okVersion", { version: data.version })
            : t("settings.connection.ok"),
        );
      } else {
        toast.error(t("settings.connection.failed", { error: data.error ?? t("settings.connection.unknownError") }));
      }
    } catch {
      setStatusMap((m) => ({ ...m, [id]: "error" }));
      toast.error(t("settings.connection.testFailed"));
    } finally {
      setTesting(null);
    }
  }

  async function deleteIndexer(id: string) {
    if (!confirm(t("settings.indexers.deleteConfirm"))) return;
    try {
      await fetch(`/api/indexers?id=${id}`, { method: "DELETE" });
      toast.success(t("settings.indexers.removed"));
      onRefresh();
    } catch {
      toast.error(t("settings.indexers.deleteFailed"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("settings.indexers.heading")}</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("settings.indexers.add")}
        </button>
      </div>

      {showAdd && (
        <div className="nv-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("settings.indexers.newTitle")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.connection.name")}</label>
              <input className="nv-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Prowlarr" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.indexers.urlLabel")}</label>
              <input className="nv-input w-full" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={defaultServiceUrl("prowlarr")} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.connection.apiKey")}</label>
              <input className="nv-input w-full font-mono" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={t("settings.connection.apiKeyPlaceholder")} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.indexers.categories")}</label>
              <input className="nv-input w-full" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} placeholder={t("settings.indexers.categoriesPlaceholderAdd")} />
              <p className="text-xs text-muted-foreground mt-1">{t("settings.indexers.categoriesHint")}</p>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.indexers.tags")}</label>
              <input
                className="nv-input w-full"
                value={form.prowlarrTags}
                onChange={(e) => setForm({ ...form, prowlarrTags: e.target.value })}
                placeholder={defaultProwlarrTags}
              />
              <p className="text-xs text-muted-foreground mt-1">
                <CodeText text={t("settings.indexers.tagsHint")} codeClassName="text-[11px]" />
              </p>
            </div>
          </div>
          <AddFormActions
            tested={isTested}
            testing={testingNew}
            saving={saving}
            canTest={!!form.url && !!form.apiKey}
            onTest={testNew}
            onCancel={() => { setShowAdd(false); setTestedKey(null); }}
            onSave={addIndexer}
          />
        </div>
      )}

      {indexers.length === 0 ? (
        <div className="nv-card p-8 text-center text-muted-foreground text-sm">{t("settings.indexers.empty")}</div>
      ) : (
        <div className="nv-card divide-y divide-border overflow-hidden">
          {indexers.map((idx) => (
            <div key={idx.id} className="flex items-center gap-3 p-4">
              <StatusDot status={statusMap[idx.id] ?? idx.lastStatus ?? "unknown"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{idx.name}</p>
                <p className="text-xs text-muted-foreground truncate">{idx.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testIndexer(idx.id)}
                  disabled={testing === idx.id}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {testing === idx.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.test")}
                </button>
                <button onClick={() => openEdit(idx)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title={t("common.edit")}>
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => deleteIndexer(idx.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <EditModal
          title={t("settings.connection.editTitle", { name: editItem.name })}
          saving={savingEdit}
          saveDisabled={!editApiKeyVerified}
          saveDisabledReason={!editApiKeyVerified ? t("settings.connection.testNewKey") : undefined}
          onClose={() => setEditItem(null)}
          onSave={saveEdit}
        >
          <EditField label={t("settings.connection.name")}>
            <input className="nv-input w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </EditField>
          <EditField label={t("settings.indexers.urlLabel")}>
            <input
              className="nv-input w-full"
              value={editForm.url}
              onChange={(e) => {
                setEditForm({ ...editForm, url: e.target.value });
                setEditTestedKey(null);
              }}
              placeholder={defaultServiceUrl("prowlarr")}
            />
          </EditField>
          <EditField
            label={t("settings.connection.apiKey")}
            hint={
              editForm.apiKeySet
                ? t("settings.connection.apiKeySaved")
                : undefined
            }
          >
            <input
              className="nv-input w-full font-mono"
              type="password"
              value={editForm.apiKey}
              onChange={(e) => {
                setEditForm({ ...editForm, apiKey: e.target.value });
                setEditTestedKey(null);
              }}
              autoComplete="new-password"
            />
          </EditField>
          {editNeedsApiKeyTest && (
            <EditConnectionBar
              verified={editApiKeyVerified}
              testing={testingEdit}
              canTest={!!editForm.url && !!editForm.apiKey.trim()}
              onTest={testEdit}
            />
          )}
          <EditField label={t("settings.indexers.categories")} hint={t("settings.indexers.categoriesHint")}>
            <input className="nv-input w-full" value={editForm.categories} onChange={(e) => setEditForm({ ...editForm, categories: e.target.value })} placeholder={t("settings.indexers.categoriesPlaceholderEdit")} />
          </EditField>
          <EditField
            label={t("settings.indexers.tags")}
            hint={t("settings.indexers.tagsHintEdit")}
          >
            <input
              className="nv-input w-full"
              value={editForm.prowlarrTags}
              onChange={(e) => setEditForm({ ...editForm, prowlarrTags: e.target.value })}
              placeholder={defaultProwlarrTags}
            />
          </EditField>
          <EnabledRow checked={editForm.enabled} onChange={() => setEditForm({ ...editForm, enabled: !editForm.enabled })} />
        </EditModal>
      )}
    </div>
  );
}


function ClientsTab({ clients, onRefresh }: { clients: MaskedDownloadClient[]; onRefresh: () => void }) {
  const t = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, "ok" | "error">>({});
  const [form, setForm] = useState({
    name: "SABnzbd",
    type: "sabnzbd" as "sabnzbd" | "nzbget",
    url: defaultServiceUrl("sabnzbd"),
    apiKey: "",
    category: "snatcharr",
    isDefault: true,
  });
  const [saving, setSaving] = useState(false);
  const [testedKey, setTestedKey] = useState<string | null>(null);
  const [testingNew, setTestingNew] = useState(false);

  const [editItem, setEditItem] = useState<MaskedDownloadClient | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "sabnzbd" as "sabnzbd" | "nzbget",
    url: "",
    apiKey: "",
    apiKeySet: false,
    category: "",
    enabled: true,
    isDefault: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTestedKey, setEditTestedKey] = useState<string | null>(null);
  const [testingEdit, setTestingEdit] = useState(false);

  const currentKey = `${form.type}|${form.url}|${form.apiKey}`;
  const isTested = testedKey === currentKey && !!form.url && !!form.apiKey;
  const editConnectionKey = `${editForm.type}|${editForm.url}|${editForm.apiKey}`;
  const editNeedsApiKeyTest = !!editForm.apiKey.trim();
  const editApiKeyVerified = !editNeedsApiKeyTest || editTestedKey === editConnectionKey;

  function openEdit(c: MaskedDownloadClient) {
    setEditForm({
      name: c.name,
      type: c.type === "nzbget" ? "nzbget" : "sabnzbd",
      url: c.url,
      apiKey: "",
      apiKeySet: !!c.apiKeySet,
      category: c.category ?? "snatcharr",
      enabled: c.enabled ?? true,
      isDefault: c.isDefault ?? false,
    });
    setEditTestedKey(null);
    setEditItem(c);
  }

  async function testEdit() {
    if (!editForm.apiKey.trim() || !editForm.url) return;
    setTestingEdit(true);
    const res = await testConnection(editForm.type, editForm.url, editForm.apiKey, t("settings.connection.failedShort"));
    if (res.ok) {
      setEditTestedKey(editConnectionKey);
      toast.success(t("settings.connection.ok"));
    } else {
      setEditTestedKey(null);
      toast.error(t("settings.connection.failed", { error: res.error ?? "" }));
    }
    setTestingEdit(false);
  }

  async function saveEdit() {
    if (!editItem) return;
    if (!editApiKeyVerified) {
      toast.error(t("settings.connection.testNewKey"));
      return;
    }
    setSavingEdit(true);
    try {
      const { apiKey, apiKeySet: _apiKeySet, ...rest } = editForm;
      const r = await fetch(`/api/download-clients/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      if (!r.ok) throw new Error();
      toast.success(t("settings.clients.updated"));
      setEditItem(null);
      onRefresh();
    } catch {
      toast.error(t("settings.clients.updateFailed"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function testNew() {
    setTestingNew(true);
    const res = await testConnection(form.type, form.url, form.apiKey, t("settings.connection.failedShort"));
    if (res.ok) {
      setTestedKey(currentKey);
      toast.success(t("settings.connection.ok"));
    } else {
      setTestedKey(null);
      toast.error(t("settings.connection.failed", { error: res.error ?? "" }));
    }
    setTestingNew(false);
  }

  async function addClient() {
    setSaving(true);
    try {
      const response = await fetch("/api/download-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error();
      toast.success(t("settings.clients.added"));
      setShowAdd(false);
      setTestedKey(null);
      setForm((f) => ({ ...f, isDefault: clients.length === 0 }));
      onRefresh();
    } catch {
      toast.error(t("settings.clients.addFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function testClient(id: string) {
    setTesting(id);
    try {
      const response = await fetch(`/api/download-clients/${id}/test`, { method: "POST" });
      const data = await response.json() as { ok: boolean; version?: string; error?: string };
      setStatusMap((m) => ({ ...m, [id]: data.ok ? "ok" : "error" }));
      if (data.ok) {
        toast.success(
          data.version
            ? t("settings.connection.okVersion", { version: data.version })
            : t("settings.connection.ok"),
        );
      } else {
        toast.error(t("settings.connection.failed", { error: data.error ?? t("settings.connection.unknownError") }));
      }
    } catch {
      setStatusMap((m) => ({ ...m, [id]: "error" }));
      toast.error(t("settings.connection.testFailed"));
    } finally {
      setTesting(null);
    }
  }

  async function deleteClient(id: string) {
    if (!confirm(t("settings.clients.deleteConfirm"))) return;
    try {
      await fetch(`/api/download-clients?id=${id}`, { method: "DELETE" });
      toast.success(t("settings.clients.removed"));
      onRefresh();
    } catch {
      toast.error(t("settings.clients.deleteFailed"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t("settings.clients.heading")}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border bg-card hover:bg-accent transition-colors"
          >
            <Info className="h-4 w-4" /> {t("settings.clients.guide")}
          </button>
          <button
            onClick={() => {
              if (!showAdd) setForm((f) => ({ ...f, isDefault: clients.length === 0 }));
              setShowAdd(!showAdd);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t("settings.clients.add")}
          </button>
        </div>
      </div>

      {showGuide && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <h3 className="text-sm font-semibold">{t("settings.clients.guideTitle")}</h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {t("setup.clientGuideSabnzbd")}
              </p>
            </div>
            <div className="p-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                {t("setup.gotIt")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="nv-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("settings.clients.newTitle")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("setup.type")}</label>
              <select
                className="nv-input w-full"
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as typeof form.type;
                  setForm({
                    ...form,
                    type,
                    url: defaultServiceUrl(type),
                    name: type === "nzbget" ? "NZBGet" : "SABnzbd",
                  });
                  setTestedKey(null);
                }}
              >
                <option value="sabnzbd">SABnzbd</option>
                <option value="nzbget">NZBGet</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.connection.name")}</label>
              <input className="nv-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.connection.url")}</label>
              <input className="nv-input w-full" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={defaultServiceUrl(form.type)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.connection.apiKey")}</label>
              <input className="nv-input w-full font-mono" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("common.category")}</label>
              <input className="nv-input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="snatcharr" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            <span>{t("settings.clients.defaultClient")}</span>
            <span className="text-xs text-muted-foreground">{t("settings.clients.defaultClientHint")}</span>
          </label>
          <AddFormActions
            tested={isTested}
            testing={testingNew}
            saving={saving}
            canTest={!!form.url && !!form.apiKey}
            onTest={testNew}
            onCancel={() => { setShowAdd(false); setTestedKey(null); }}
            onSave={addClient}
          />
        </div>
      )}

      {clients.length === 0 ? (
        <div className="nv-card p-8 text-center text-muted-foreground text-sm">{t("settings.clients.empty")}</div>
      ) : (
        <div className="nv-card divide-y divide-border overflow-hidden">
          {clients.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-4">
              <StatusDot status={statusMap[c.id] ?? c.lastStatus ?? "unknown"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {c.name}{" "}
                  <span className="text-xs text-muted-foreground">({c.type})</span>
                  {c.isDefault && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary font-semibold">
                      {t("settings.clients.defaultBadge")}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{c.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => testClient(c.id)} disabled={testing === c.id} className="px-3 py-1 text-xs border border-border rounded hover:bg-accent transition-colors disabled:opacity-50">
                  {testing === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.test")}
                </button>
                <button onClick={() => openEdit(c)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title={t("common.edit")}>
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => deleteClient(c.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <EditModal
          title={t("settings.connection.editTitle", { name: editItem.name })}
          saving={savingEdit}
          saveDisabled={!editApiKeyVerified}
          saveDisabledReason={!editApiKeyVerified ? t("settings.connection.testNewKey") : undefined}
          onClose={() => setEditItem(null)}
          onSave={saveEdit}
        >
          <EditField label={t("setup.type")}>
            <select
              className="nv-input w-full"
              value={editForm.type}
              onChange={(e) => {
                setEditForm({ ...editForm, type: e.target.value as typeof editForm.type });
                setEditTestedKey(null);
              }}
            >
              <option value="sabnzbd">SABnzbd</option>
              <option value="nzbget">NZBGet</option>
            </select>
          </EditField>
          <EditField label={t("settings.connection.name")}>
            <input className="nv-input w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </EditField>
          <EditField label={t("settings.connection.url")}>
            <input
              className="nv-input w-full"
              value={editForm.url}
              onChange={(e) => {
                setEditForm({ ...editForm, url: e.target.value });
                setEditTestedKey(null);
              }}
              placeholder={defaultServiceUrl(editForm.type)}
            />
          </EditField>
          <EditField
            label={t("settings.connection.apiKey")}
            hint={
              editForm.apiKeySet
                ? t("settings.connection.apiKeySaved")
                : undefined
            }
          >
            <input
              className="nv-input w-full font-mono"
              type="password"
              value={editForm.apiKey}
              onChange={(e) => {
                setEditForm({ ...editForm, apiKey: e.target.value });
                setEditTestedKey(null);
              }}
              autoComplete="new-password"
            />
          </EditField>
          {editNeedsApiKeyTest && (
            <EditConnectionBar
              verified={editApiKeyVerified}
              testing={testingEdit}
              canTest={!!editForm.url && !!editForm.apiKey.trim()}
              onTest={testEdit}
            />
          )}
          <EditField label={t("common.category")} hint={t("settings.clients.categoryHint")}>
            <input className="nv-input w-full" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
          </EditField>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={editForm.isDefault}
              onChange={(e) => setEditForm({ ...editForm, isDefault: e.target.checked })}
            />
            <span>{t("settings.clients.defaultClient")}</span>
          </label>
          <EnabledRow checked={editForm.enabled} onChange={() => setEditForm({ ...editForm, enabled: !editForm.enabled })} />
        </EditModal>
      )}
    </div>
  );
}


function AppsTab({ apps, onRefresh }: { apps: MaskedExternalApp[]; onRefresh: () => void }) {
  const t = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "Jellyfin",
    type: "jellyfin" as AdditionalAppType,
    url: ADDITIONAL_APP_TYPES.jellyfin.defaultUrl,
    apiKey: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, "ok" | "error">>({});
  const [testedKey, setTestedKey] = useState<string | null>(null);
  const [testingNew, setTestingNew] = useState(false);

  const [editItem, setEditItem] = useState<MaskedExternalApp | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "jellyfin" as AdditionalAppType,
    url: "",
    apiKey: "",
    apiKeySet: false,
    enabled: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTestedKey, setEditTestedKey] = useState<string | null>(null);
  const [testingEdit, setTestingEdit] = useState(false);

  const currentKey = `${form.type}|${form.url}|${form.apiKey}`;
  const isTested = testedKey === currentKey && !!form.url;
  const editConnectionKey = `${editForm.type}|${editForm.url}|${editForm.apiKey}`;
  const editNeedsApiKeyTest = !!editForm.apiKey.trim();
  const editApiKeyVerified = !editNeedsApiKeyTest || editTestedKey === editConnectionKey;

  function openEdit(app: MaskedExternalApp) {
    setEditForm({
      name: app.name,
      type: (app.type in ADDITIONAL_APP_TYPES ? app.type : "jellyfin") as AdditionalAppType,
      url: app.url,
      apiKey: "",
      apiKeySet: !!app.apiKeySet,
      enabled: app.enabled ?? true,
    });
    setEditTestedKey(null);
    setEditItem(app);
  }

  async function testEdit() {
    if (!editForm.apiKey.trim() || !editForm.url) return;
    setTestingEdit(true);
    const res = await testConnection(editForm.type, editForm.url, editForm.apiKey, t("settings.connection.failedShort"));
    if (res.ok) {
      setEditTestedKey(editConnectionKey);
      toast.success(t("settings.connection.ok"));
    } else {
      setEditTestedKey(null);
      toast.error(t("settings.connection.failed", { error: res.error ?? "" }));
    }
    setTestingEdit(false);
  }

  async function saveEdit() {
    if (!editItem) return;
    if (!editApiKeyVerified) {
      toast.error(t("settings.connection.testNewKey"));
      return;
    }
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/apps/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          url: editForm.url,
          enabled: editForm.enabled,
          ...(editForm.apiKey.trim() ? { apiKey: editForm.apiKey.trim() } : {}),
        }),
      });
      if (!r.ok) throw new Error();
      toast.success(t("settings.apps.updated"));
      setEditItem(null);
      onRefresh();
    } catch {
      toast.error(t("settings.apps.updateFailed"));
    } finally {
      setSavingEdit(false);
    }
  }

  function selectType(type: AdditionalAppType) {
    // Prefill name + URL based on the chosen app type.
    setForm({
      ...form,
      type,
      name: ADDITIONAL_APP_TYPES[type].label,
      url: ADDITIONAL_APP_TYPES[type].defaultUrl,
    });
    setTestedKey(null);
  }

  async function testNew() {
    setTestingNew(true);
    const res = await testConnection(form.type, form.url, form.apiKey, t("settings.connection.failedShort"));
    if (res.ok) {
      setTestedKey(currentKey);
      toast.success(t("settings.connection.ok"));
    } else {
      setTestedKey(null);
      toast.error(t("settings.connection.failed", { error: res.error ?? "" }));
    }
    setTestingNew(false);
  }

  async function testApp(id: string) {
    setTesting(id);
    try {
      const response = await fetch(`/api/apps/${id}/test`, { method: "POST" });
      const data = await response.json() as { ok: boolean; version?: string; error?: string };
      setStatusMap((m) => ({ ...m, [id]: data.ok ? "ok" : "error" }));
      if (data.ok) {
        toast.success(
          data.version
            ? t("settings.connection.okVersion", { version: data.version })
            : t("settings.connection.ok"),
        );
      } else {
        toast.error(t("settings.connection.failed", { error: data.error ?? t("settings.connection.unknownError") }));
      }
    } catch {
      setStatusMap((m) => ({ ...m, [id]: "error" }));
      toast.error(t("settings.connection.testFailed"));
    } finally {
      setTesting(null);
    }
  }

  async function addApp() {
    setSaving(true);
    try {
      const response = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error();
      toast.success(t("settings.apps.added"));
      setShowAdd(false);
      setTestedKey(null);
      onRefresh();
    } catch {
      toast.error(t("settings.apps.addFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteApp(id: string) {
    if (!confirm(t("settings.apps.removeConfirm"))) return;
    try {
      await fetch(`/api/apps?id=${id}`, { method: "DELETE" });
      toast.success(t("settings.apps.removed"));
      onRefresh();
    } catch {
      toast.error(t("settings.apps.removeFailed"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("settings.apps.heading")}</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" /> {t("settings.apps.add")}
        </button>
      </div>

      {showAdd && (
        <div className="nv-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("setup.type")}</label>
              <select className="nv-input w-full" value={form.type} onChange={(e) => selectType(e.target.value as AdditionalAppType)}>
                {Object.entries(ADDITIONAL_APP_TYPES).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.connection.name")}</label>
              <input className="nv-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.connection.url")}</label>
              <input className="nv-input w-full" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={ADDITIONAL_APP_TYPES[form.type].defaultUrl} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("settings.connection.apiKey")}</label>
              <input
                className="nv-input w-full font-mono"
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Feature list for the selected app type */}
          <div className="rounded-md bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">
              {t("settings.apps.featuresTitle", { app: ADDITIONAL_APP_TYPES[form.type].label })}
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              {ADDITIONAL_APP_TYPES[form.type].features.map((f, index) => (
                <li key={f}>{t(`setup.appFeatures.${form.type}.${index}`)}</li>
              ))}
            </ul>
            <p className="text-xs text-primary font-medium pt-1 border-t border-border/60">
              {t("setup.appLoginNote")}
            </p>
          </div>

          <AddFormActions
            tested={isTested}
            testing={testingNew}
            saving={saving}
            canTest={!!form.url}
            onTest={testNew}
            onCancel={() => { setShowAdd(false); setTestedKey(null); }}
            onSave={addApp}
          />
        </div>
      )}

      {apps.length === 0 ? (
        <div className="nv-card p-8 text-center text-muted-foreground text-sm">{t("settings.apps.empty")}</div>
      ) : (
        <div className="nv-card divide-y divide-border overflow-hidden">
          {apps.map((app) => (
            <div key={app.id} className="flex items-center gap-3 p-4">
              <StatusDot status={statusMap[app.id] ?? app.lastStatus ?? "unknown"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{app.name} <span className="text-xs text-muted-foreground">({app.type})</span></p>
                <p className="text-xs text-muted-foreground truncate">{app.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testApp(app.id)}
                  disabled={testing === app.id}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {testing === app.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.test")}
                </button>
                <button onClick={() => openEdit(app)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title={t("common.edit")}>
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => deleteApp(app.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <EditModal
          title={t("settings.connection.editTitle", { name: editItem.name })}
          saving={savingEdit}
          saveDisabled={!editApiKeyVerified}
          saveDisabledReason={!editApiKeyVerified ? t("settings.connection.testNewKey") : undefined}
          onClose={() => setEditItem(null)}
          onSave={saveEdit}
        >
          <EditField label={t("setup.type")}>
            <select
              className="nv-input w-full"
              value={editForm.type}
              onChange={(e) => {
                const type = e.target.value as AdditionalAppType;
                setEditForm({
                  ...editForm,
                  type,
                  url: editForm.url || ADDITIONAL_APP_TYPES[type].defaultUrl,
                });
                setEditTestedKey(null);
              }}
            >
              {Object.entries(ADDITIONAL_APP_TYPES).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </EditField>
          <EditField label={t("settings.connection.name")}>
            <input className="nv-input w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </EditField>
          <EditField label={t("settings.connection.url")}>
            <input
              className="nv-input w-full"
              value={editForm.url}
              onChange={(e) => {
                setEditForm({ ...editForm, url: e.target.value });
                setEditTestedKey(null);
              }}
              placeholder={additionalAppMeta(editForm.type).defaultUrl}
            />
          </EditField>
          <EditField
            label={t("settings.connection.apiKey")}
            hint={
              editForm.apiKeySet
                ? t("settings.connection.apiKeySaved")
                : undefined
            }
          >
            <input
              className="nv-input w-full font-mono"
              type="password"
              value={editForm.apiKey}
              onChange={(e) => {
                setEditForm({ ...editForm, apiKey: e.target.value });
                setEditTestedKey(null);
              }}
              autoComplete="new-password"
            />
          </EditField>
          {editNeedsApiKeyTest && (
            <EditConnectionBar
              verified={editApiKeyVerified}
              testing={testingEdit}
              canTest={!!editForm.url && !!editForm.apiKey.trim()}
              onTest={testEdit}
            />
          )}
          <EnabledRow checked={editForm.enabled} onChange={() => setEditForm({ ...editForm, enabled: !editForm.enabled })} />
        </EditModal>
      )}
    </div>
  );
}


function SaveBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  const t = useT();
  return (
    <div className="flex justify-end pt-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? t("common.saving") : t("common.save")}
      </button>
    </div>
  );
}

function AddFormActions({
  tested,
  testing,
  saving,
  canTest,
  onTest,
  onCancel,
  onSave,
}: {
  tested: boolean;
  testing: boolean;
  saving: boolean;
  canTest: boolean;
  onTest: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs">
        {tested ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-green-400">{t("settings.connection.verified")}</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("settings.connection.testBeforeSaving")}</span>
          </>
        )}
      </span>
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">{t("common.cancel")}</button>
        <button
          onClick={onTest}
          disabled={!canTest || testing}
          className="flex items-center gap-2 px-4 py-1.5 border border-border rounded-md text-sm hover:bg-accent disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : null} {t("common.test")}
        </button>
        <button
          onClick={onSave}
          disabled={!tested || saving}
          title={!tested ? t("settings.connection.runTestFirst") : undefined}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {t("common.save")}
        </button>
      </div>
    </div>
  );
}

function EditConnectionBar({
  verified,
  testing,
  canTest,
  onTest,
}: {
  verified: boolean;
  testing: boolean;
  canTest: boolean;
  onTest: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs">
        {verified ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-green-400">{t("settings.connection.newKeyVerified")}</span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("settings.connection.testNewKey")}</span>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={onTest}
        disabled={!canTest || testing}
        className="flex items-center gap-2 px-3 py-1 border border-border rounded-md text-xs hover:bg-accent disabled:opacity-50"
      >
        {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {t("common.test")}
      </button>
    </div>
  );
}

function EditModal({
  title,
  saving,
  saveDisabled,
  saveDisabledReason,
  onClose,
  onSave,
  children,
}: {
  title: string;
  saving: boolean;
  saveDisabled?: boolean;
  saveDisabledReason?: string;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="nv-card w-full max-w-md p-5 space-y-4 animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-primary" />
            {title}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">{t("common.cancel")}</button>
          <button
            onClick={onSave}
            disabled={saving || saveDisabled}
            title={saveDisabled ? saveDisabledReason : undefined}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EnabledRow({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between border-t border-border pt-3">
      <p className="text-sm font-medium">{t("settings.connection.enabled")}</p>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors shrink-0",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full shrink-0",
        status === "ok" && "bg-green-400",
        status === "warning" && "bg-yellow-400",
        status === "error" && "bg-red-400",
        status === "unknown" && "bg-muted-foreground",
      )}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("relative w-10 h-5 rounded-full shrink-0", checked ? "bg-primary" : "bg-muted")}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
