"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { User, Save, Loader2, Eye, EyeOff, Key, Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ProfileView() {
  const { data: session } = useSession();
  const [showGrabsPublic, setShowGrabsPublic] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  async function saveProfile() {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showGrabsPublic, emailNotifications }),
      });
      if (!response.ok) throw new Error();
      toast.success("Profile updated");
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

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        My Profile
      </h1>

      {/* Account info */}
      <div className="nv-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Account</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xl font-bold text-primary uppercase">
            {session?.user?.username?.charAt(0) ?? "?"}
          </div>
          <div>
            <p className="text-lg font-semibold">{session?.user?.username ?? "—"}</p>
            <p className="text-sm text-muted-foreground capitalize">
              {session?.user?.role ?? "user"}
            </p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="nv-card p-5 space-y-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preferences</h2>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              {showGrabsPublic ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-sm font-medium">Public Grabs by Default</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              New grabs will be visible to all users
            </p>
          </div>
          <Toggle checked={showGrabsPublic} onChange={() => setShowGrabsPublic(!showGrabsPublic)} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Email Notifications</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">
              Get notified when downloads complete
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
            Save Preferences
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="nv-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Key className="h-4 w-4" />
          Change Password
        </h2>

        <div className="space-y-3">
          {[
            { label: "Current Password", key: "current" as const },
            { label: "New Password (min 8 chars)", key: "newPass" as const },
            { label: "Confirm New Password", key: "confirm" as const },
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
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
}
