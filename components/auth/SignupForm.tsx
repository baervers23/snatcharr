"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, UserPlus, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidSignupEmail, meetsSignupPassword } from "@/lib/password-policy";
import { useT } from "@/lib/i18n/client";

interface SignupFormProps {
  requireEmail?: boolean;
}

export default function SignupForm({ requireEmail = false }: SignupFormProps) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");

  const passwordOk = meetsSignupPassword(password);
  const emailOk = requireEmail ? isValidSignupEmail(email) : !email.trim() || isValidSignupEmail(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("auth.passwordsDoNotMatch"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          confirmPassword,
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: string;
        verificationEmailSent?: boolean;
      };
      if (!response.ok) {
        toast.error(data.error ?? t("auth.registrationFailed"));
        return;
      }

      if (data.verificationEmailSent && email.trim()) {
        setSentToEmail(email.trim());
        setVerificationSent(true);
        return;
      }

      toast.success(data.message ?? t("auth.accountCreated"));
      window.location.href = "/login";
    } catch {
      toast.error(t("auth.registrationFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (verificationSent) {
    return (
      <div className="nv-card p-6 space-y-4 text-center">
        <div className="flex justify-center">
          <MailCheck className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">{t("auth.verifyEmailTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("auth.verifyEmailBody", { email: sentToEmail })}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          {t("auth.goToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="nv-card p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="nv-label">{t("auth.username")}</label>
          <input
            className="nv-input w-full"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <label className="nv-label">{t("auth.password")}</label>
          <input
            className={cn(
              "nv-input w-full transition-colors",
              password.length > 0 && (passwordOk ? "border-green-500 focus:border-green-500" : "border-red-500/60"),
            )}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
          <p
            className={cn(
              "text-xs transition-colors",
              passwordOk ? "text-green-500" : "text-muted-foreground",
            )}
          >
            {t("auth.passwordHint")}
          </p>
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
        <div className="space-y-2">
          <label className="nv-label">
            {requireEmail ? t("auth.emailRequired") : t("auth.emailOptional")}
          </label>
          <input
            className={cn(
              "nv-input w-full transition-colors",
              email.trim().length > 0 &&
                (emailOk ? "border-green-500 focus:border-green-500" : "border-red-500/60"),
            )}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required={requireEmail}
            autoComplete="email"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {loading ? t("auth.creatingAccount") : t("auth.signUp")}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-4">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("auth.signInLink")}
        </Link>
      </p>
    </div>
  );
}
