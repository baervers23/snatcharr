"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Download,
  FlaskConical,
  Languages,
  Loader2,
  Trash2,
  UserPlus,
  Bell,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

interface DebugStatus {
  enabled: boolean;
  mockExternal: boolean;
  uiLanguage: string;
  userDownloadSpeedLimitMbit: number;
  infoPopupMode: string;
  infoPopupTitle: string;
  seeds: {
    user: { id: string; username: string; active: boolean } | null;
    grab: { id: string; status: string; filesOk: boolean } | null;
  };
  credentials: { username: string; password: string };
}

export default function DebugView() {
  const t = useT();
  const [status, setStatus] = useState<DebugStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/debug");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? t("system.debug.unavailable"));
      }
      setStatus((await res.json()) as DebugStatus);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("system.debug.loadFailed"));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const res = await fetch("/api/system/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = (await res.json()) as { error?: string; reload?: boolean; id?: string };
      if (!res.ok) throw new Error(data.error ?? t("system.debug.actionFailed"));
      toast.success(t("system.debug.actionOk", { action }));
      if (data.reload) {
        window.location.reload();
        return;
      }
      await refresh();
      return data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("system.debug.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("system.debug.loading")}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="nv-card p-5 text-sm text-muted-foreground">
        {t("system.debug.offIntro")} <code className="bg-muted px-1 rounded">SNATCHARR_DEBUG=1</code>{" "}
        {t("system.debug.offMiddle")} <code className="bg-muted px-1 rounded">NODE_ENV=development</code>.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-foreground">{t("system.debug.bannerTitle")}</p>
          <p className="text-muted-foreground">
            {t("system.debug.bannerDesc")}
          </p>
        </div>
      </div>

      <section className="nv-card p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          {t("system.debug.seeds")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <StatusLine
            ok={!!status.seeds.user}
            label={t("system.debug.debugUser")}
            detail={
              status.seeds.user
                ? `${status.seeds.user.username} (${status.credentials.password})`
                : t("system.debug.notCreated")
            }
          />
          <StatusLine
            ok={!!status.seeds.grab?.filesOk}
            label={t("system.debug.completedGrab")}
            detail={
              status.seeds.grab
                ? `${status.seeds.grab.status}${status.seeds.grab.filesOk ? "" : t("system.debug.filesMissing")}`
                : t("system.debug.notCreated")
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={UserPlus}
            label={t("system.debug.seedUser")}
            busy={busy === "seed-user"}
            onClick={() => run("seed-user")}
          />
          <ActionButton
            icon={Download}
            label={t("system.debug.seedGrab")}
            busy={busy === "seed-grab"}
            onClick={() => run("seed-grab")}
          />
          <ActionButton
            icon={Trash2}
            label={t("system.debug.cleanupSeeds")}
            busy={busy === "cleanup"}
            danger
            onClick={() => run("cleanup")}
          />
        </div>
      </section>

      <section className="nv-card p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          {t("system.debug.presets")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("system.debug.presetsDesc")}
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={Bell}
            label={t("system.debug.enableNotice")}
            busy={busy === "apply-notice"}
            onClick={() => run("apply-notice")}
          />
          <ActionButton
            icon={Gauge}
            label={t("system.debug.speedLimit")}
            busy={busy === "set-speed-limit"}
            onClick={() => run("set-speed-limit", { mbit: 1 })}
          />
          <ActionButton
            icon={Gauge}
            label={t("system.debug.speedUnlimited")}
            busy={busy === "set-speed-limit"}
            onClick={() => run("set-speed-limit", { mbit: 0 })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{t("system.debug.language")}</span>
          {SUPPORTED_LOCALES.map((locale) => (
            <button
              key={locale.code}
              type="button"
              disabled={busy !== null}
              onClick={() => run("set-language", { language: locale.code })}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                status.uiLanguage === locale.code
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {locale.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("system.debug.current", {
            mode: status.infoPopupMode,
            title: status.infoPopupTitle ? ` “${status.infoPopupTitle}”` : "",
            speed: status.userDownloadSpeedLimitMbit || "∞",
            lang: status.uiLanguage,
          })}
        </p>
      </section>

      <section className="nv-card p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          {t("system.debug.externalMock")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("system.debug.mockDesc")}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("set-mock", { enabled: !status.mockExternal })}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              status.mockExternal
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                : "bg-muted text-muted-foreground border border-border hover:text-foreground",
            )}
          >
            {busy === "set-mock" ? (
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            ) : null}
            {status.mockExternal ? t("system.debug.mockOn") : t("system.debug.mockOff")}
          </button>
          {status.seeds.grab?.id && (
            <a
              href={`/grabs`}
              className="text-sm text-primary hover:underline"
            >
              {t("system.debug.openGrabs")}
            </a>
          )}
          <a href="/search" className="text-sm text-primary hover:underline">
            {t("system.debug.openSearch")}
          </a>
        </div>
      </section>

      <section className="nv-card p-5 space-y-3">
        <h2 className="text-sm font-semibold">{t("system.debug.flowTitle")}</h2>
        <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1.5">
          <li>{t("system.debug.flow1")}</li>
          <li>{t("system.debug.flow2")}</li>
          <li>{t("system.debug.flow3")}</li>
          <li>{t("system.debug.flow4")}</li>
          <li>{t("system.debug.flow5")}</li>
        </ol>
      </section>
    </div>
  );
}

function StatusLine({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  busy,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  busy: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-50",
        danger
          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
          : "border-border hover:bg-accent text-foreground",
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
