"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("auth.passwordsDoNotMatch"));
      return;
    }
    if (!token) {
      toast.error(t("auth.invalidResetLink"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? t("auth.resetFailed"));
        return;
      }
      toast.success(t("auth.passwordResetSuccess"));
      router.push("/login");
    } catch {
      toast.error(t("auth.resetFailedRetry"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="nv-card p-6 text-center space-y-3">
        <p className="text-sm text-destructive">{t("auth.invalidResetLink")}</p>
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          {t("auth.requestNewLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="nv-card p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="nv-label">{t("auth.newPassword")}</label>
          <input
            className="nv-input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
        </div>
        <div className="space-y-2">
          <label className="nv-label">{t("auth.confirmPassword")}</label>
          <input
            className="nv-input w-full"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {loading ? t("common.saving") : t("auth.setNewPassword")}
        </button>
      </form>
    </div>
  );
}
