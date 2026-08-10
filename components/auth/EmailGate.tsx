"use client";

import { useState } from "react";
import { Mail, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

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
  const [value, setValue] = useState(email ?? "");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    if (!smtpEnabled) {
      toast.error("SMTP is not configured — ask an admin to enable Settings → Email or use Jellyfin/Seerr login");
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
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("Email saved — check your inbox to verify");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save email");
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    if (!smtpEnabled) {
      toast.error("SMTP is not configured — use Jellyfin/Seerr login or ask an admin to approve your email");
      return;
    }
    setResending(true);
    try {
      const res = await fetch("/api/profile/verify-email", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      toast.success("Verification email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  }

  const helpLines: string[] = [];
  if (syncAppsEnabled) {
    helpLines.push("Log in via Jellyfin or Seerr to import and verify your email automatically.");
  }
  if (smtpEnabled) {
    helpLines.push("Local accounts can verify by email (SMTP is configured).");
  }
  if (!smtpEnabled && !syncAppsEnabled) {
    helpLines.push("Ask an admin to enable SMTP (Settings → Email) or a Jellyfin/Seerr sync app.");
  }
  helpLines.push("Admins can approve email under Users → edit.");

  if (mode === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md nv-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Verify your email</h1>
              <p className="text-sm text-muted-foreground">
                Hi {username}, access is restricted until your email is verified or approved by an admin.
              </p>
            </div>
          </div>
          {email && (
            <p className="text-sm">
              Pending: <span className="font-mono">{email}</span>
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
              Resend verification email
            </button>
          ) : syncAppsEnabled ? (
            <p className="text-sm text-muted-foreground rounded-md border border-border px-3 py-2">
              No SMTP configured. Sign out and log in again with <strong>Jellyfin</strong> or{" "}
              <strong>Seerr</strong> to sync and verify your email.
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
            <h1 className="text-lg font-semibold">Email required</h1>
            <p className="text-sm text-muted-foreground">
              Hi {username}, an email address is required before you can continue.
            </p>
          </div>
        </div>
        {syncAppsEnabled && !smtpEnabled ? (
          <p className="text-sm text-muted-foreground rounded-md border border-border px-3 py-2">
            Sign out and log in with <strong>Jellyfin</strong> or <strong>Seerr</strong> to import your email
            automatically.
          </p>
        ) : null}
        {smtpEnabled ? (
          <form onSubmit={saveEmail} className="space-y-3">
            <input
              type="email"
              required
              className="nv-input w-full"
              placeholder="you@example.com"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving}
              className="nv-btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save &amp; send verification
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
