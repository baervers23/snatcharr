"use client";
import type { AppSettings } from "@/lib/db/settings";
import { formatTimeUntilReset } from "@/lib/daily-limits";
import { cn } from "@/lib/utils";
import { BarChart2, Bell, Eye, Key, Loader2, Mail, Save, User } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";
interface DailyLimits {
  searchUsed: number;
  searchMax: number;
  grabUsed: number;
  personalGrabUsed: number;
  globalGrabMax: number;
  grabMax: number;
  downloadUsed: number;
  downloadMax: number;
  manualNzbUsed?: number;
  manualNzbMax?: number;
  resetInMs: number;
  resetAtHour: number;
}
interface Props {
  username: string;
  role: "admin" | "user";
  authMethod: AppSettings["authMethod"];
  email: string | null;
  showGrabsPublic: boolean;
  emailNotifications: boolean;
  avatarUrl: string | null;
  canUploadNzb: boolean;
  limits: DailyLimits;
}
export default function ProfileView({
  username,
  role,
  authMethod,
  email: savedEmail,
  showGrabsPublic: initialShowGrabsPublic,
  emailNotifications: initialEmailNotifications,
  avatarUrl,
  canUploadNzb,
  limits,
}: Props) {
  const router = useRouter();
  const hasEmail = !!savedEmail?.trim();
  const [email, setEmail] = useState(savedEmail ?? "");
  const [showGrabsPublic, setShowGrabsPublic] = useState(initialShowGrabsPublic);
  const [emailNotifications, setEmailNotifications] = useState(initialEmailNotifications);
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const externalAuth = authMethod !== "local";
  useEffect(() => {
    setEmail(savedEmail ?? "");
  }, [savedEmail]);
  async function saveProfile() {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showGrabsPublic,
          emailNotifications,
          ...(hasEmail ? {} : { email: email.trim() || null }),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ??
            (response.status === 422
              ? "Please enter a valid email address"
              : response.status === 403
                ? "Email cannot be changed once it is set"
                : "Failed to save profile"),
        );
        return;
      }
      toast.success("Profile updated");
      if (!hasEmail && email.trim()) {
        router.refresh();
      }
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }
  async function changePassword() {
    if (passwordForm.newPass !== passwordForm.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (passwordForm.newPass.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: passwordForm.current, newPassword: passwordForm.newPass }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Failed to change password");
        return;
      }
      toast.success("Password changed");
      setPasswordForm({ current: "", newPass: "", confirm: "" });
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }
  function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow",
            checked && "translate-x-5",
          )}
        />
      </button>
    );
  }
  function LimitRow({ label, used, max, scope }: { label: string; used: number; max: number; scope: string }) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {label} <span className="text-[10px]">({scope})</span>
        </span>
        <span className="font-medium tabular-nums">
          {max > 0 ? `${used} / ${max}` : `${used} (∞)`}
        </span>
      </div>
    );
  }
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        My Profile
      </h1>
      <div className="nv-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Account</h2>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xl font-bold text-primary uppercase">
              {username.charAt(0) ?? "?"}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold">{username}</p>
            <p className="text-sm text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
      </div>
      <div className="nv-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <BarChart2 className="h-4 w-4" />
          Daily limits
        </h2>
        <p className="text-xs text-muted-foreground">
          Resets in {formatTimeUntilReset(limits.resetInMs)} (daily at {limits.resetAtHour}:00)
        </p>
        <div className="space-y-2 border-t border-border pt-3">
          <LimitRow label="Search" used={limits.searchUsed} max={limits.searchMax} scope="global" />
          <LimitRow label="Grabs" used={limits.grabUsed} max={limits.globalGrabMax} scope="global" />
          {limits.grabMax > 0 && limits.grabMax !== limits.globalGrabMax && (
            <LimitRow label="Grabs" used={limits.personalGrabUsed} max={limits.grabMax} scope="personal" />
          )}
          <LimitRow label="Downloads" used={limits.downloadUsed} max={limits.downloadMax} scope="personal" />
          {canUploadNzb && (limits.manualNzbMax ?? 0) > 0 && (
            <LimitRow
              label="Manual NZB"
              used={limits.manualNzbUsed ?? 0}
              max={limits.manualNzbMax ?? 0}
              scope="personal"
            />
          )}
        </div>
      </div>
      <div className="nv-card p-5 space-y-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preferences</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Show grabs to all users</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              New search grabs are visible to every Snatcharr user
            </p>
          </div>
          <Toggle checked={showGrabsPublic} onChange={() => setShowGrabsPublic(!showGrabsPublic)} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Email notifications</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              Notify when a download is ready
            </p>
          </div>
          <Toggle checked={emailNotifications} onChange={() => setEmailNotifications(!emailNotifications)} />
        </div>
        <div className="flex justify-end border-t border-border pt-4">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save preferences
          </button>
        </div>
      </div>
      <div className={cn("nv-card p-5 space-y-4", externalAuth && !hasEmail && "opacity-60")}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Key className="h-4 w-4" />
          {externalAuth && !hasEmail ? "Email & password" : externalAuth ? "Email" : "Email & password"}
        </h2>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email address
          </label>
          <input
            className={cn("nv-input w-full", hasEmail && "opacity-70 cursor-not-allowed")}
            type="email"
            value={email}
            onChange={hasEmail ? undefined : (e) => setEmail(e.target.value)}
            readOnly={hasEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {hasEmail ? (
            <p className="text-xs text-muted-foreground">
              Set by sync or admin — contact an admin to change.
            </p>
          ) : (
            <div className="flex justify-end pt-2">
              <button
                onClick={saveProfile}
                disabled={saving || !email.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save email
              </button>
            </div>
          )}
        </div>
        {!externalAuth && (
          <>
            <div className="space-y-3 border-t border-border pt-4">
              {[
                { label: "Current password", key: "current" as const },
                { label: "New password (min 8 chars)", key: "newPass" as const },
                { label: "Confirm new password", key: "confirm" as const },
              ].map(({ label, key }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    className="nv-input w-full"
                    type="password"
                    value={passwordForm[key]}
                    onChange={(e) => setPasswordForm({ ...passwordForm, [key]: e.target.value })}
                    autoComplete={key === "current" ? "current-password" : "new-password"}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={changePassword}
                disabled={changingPassword || !passwordForm.current || !passwordForm.newPass}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                Change password
              </button>
            </div>
          </>
        )}
        {externalAuth && (
          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Password is managed by your external login provider.
          </p>
        )}
      </div>
    </div>
  );
}
