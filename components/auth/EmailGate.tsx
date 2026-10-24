"use client";

import { useState } from "react";
import { Mail, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/client";

type Mode = "missing" | "pending";

export default function EmailGate({
  username,
  email,
  mode,
  smtpEnabled = false,
  syncAppsEnabled = false,
}: {
  username: string;
  email?: string | null;
  mode: Mode;
  smtpEnabled?: boolean;
  syncAppsEnabled?: boolean;
}) {
  const t = useT();
  const [value, setValue] = useState(email ?? "");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    if (!smtpEnabled) {
      toast.error(t("auth.smtpNotConfigured"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("auth.saveFailed"));
      toast.success(t("auth.emailSavedCheckInbox"));
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.failedToSaveEmail"));
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    if (!smtpEnabled) {
      toast.error(t("auth.smtpNotConfiguredResend"));
      return;
    }
    setResending(true);
    try {
      const res = await fetch("/api/profile/verify-email", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("auth.failedToSend"));
      toast.success(t("auth.verificationEmailSent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.failedToResend"));
    } finally {
      setResending(false);
    }
  }

  const helpLines: string[] = [];
  if (syncAppsEnabled) {
    helpLines.push(t("auth.emailGateHelpSync"));
  }
  if (smtpEnabled) {
    helpLines.push(t("auth.emailGateHelpSmtp"));
  }
  if (!smtpEnabled && !syncAppsEnabled) {
    helpLines.push(t("auth.emailGateHelpNeither"));
  }
  helpLines.push(t("auth.emailGateHelpAdmin"));

  if (mode === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md nv-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t("auth.emailGateVerify")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("auth.emailGateHiPending", { username })}
              </p>
            </div>
          </div>
          {email && (
            <p className="text-sm">
              {t("auth.emailGatePendingLabel")} <span className="font-mono">{email}</span>
            </p>
          )}
          {smtpEnabled ? (
            <button
              type="button"
              onClick={resendVerification}
              disabled={resending}
              className="nv-btn-primary w-full flex items-center justify-center gap-2"
            >
              {resending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("auth.resendVerification")}
            </button>
          ) : syncAppsEnabled ? (
            <p className="text-sm text-muted-foreground rounded-md border border-border px-3 py-2">
              {t("auth.emailGateNoSmtpSync")}
            </p>
          ) : null}
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {helpLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md nv-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{t("auth.emailGateTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.emailGateHiMissing", { username })}
            </p>
          </div>
        </div>
        {syncAppsEnabled && !smtpEnabled ? (
          <p className="text-sm text-muted-foreground rounded-md border border-border px-3 py-2">
            {t("auth.emailGateSignOutSync")}
          </p>
        ) : null}
        {smtpEnabled ? (
          <form onSubmit={saveEmail} className="space-y-3">
            <input
              type="email"
              required
              className="nv-input w-full"
              placeholder={t("auth.emailPlaceholder")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving}
              className="nv-btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("auth.saveAndSend")}
            </button>
          </form>
        ) : null}
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          {helpLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
