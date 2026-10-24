"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

interface LoginFormProps {
  callbackUrl?: string;
  error?: string;
  authModeLabel?: string | null;
  authMethod?: string | null;
  verified?: boolean;
}

function getOrganizrTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("organizr_token_") || trimmed.startsWith("organizr_token=")) {
      return trimmed;
    }
  }
  return null;
}

export default function LoginForm({
  callbackUrl,
  error,
  authModeLabel,
  authMethod,
  verified,
}: LoginFormProps) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ssoChecked, setSsoChecked] = useState(false);
  const [organizrCookie] = useState(() =>
    authMethod === "organizr-sso" ? getOrganizrTokenCookie() : null,
  );

  const errorMessages: Record<string, string> = {
    CredentialsSignin: t("auth.invalidCredentials"),
    SessionRequired: t("auth.sessionRequired"),
    Default: t("auth.genericError"),
  };
  const errorMessage = error ? (errorMessages[error] ?? errorMessages.Default) : null;
  const isOrganizrSso = authMethod === "organizr-sso";

  useEffect(() => {
    if (verified) {
      toast.success(t("auth.emailVerified"));
    }
  }, [verified, t]);

  useEffect(() => {
    if (!isOrganizrSso || ssoChecked) return;
    const cookie = getOrganizrTokenCookie();
    if (!cookie) {
      setSsoChecked(true);
      return;
    }
    setLoading(true);
    void signIn("credentials", {
      username: "sso",
      password: cookie,
      redirect: false,
    })
      .then((result) => {
        if (result?.error) {
          toast.error(
            result.error === "CredentialsSignin"
              ? t("auth.invalidCredentials")
              : t("auth.genericError"),
          );
          return;
        }
        window.location.href = callbackUrl ?? "/search";
      })
      .catch(() => {
        toast.error(t("auth.organizrSsoFailed"));
      })
      .finally(() => {
        setLoading(false);
        setSsoChecked(true);
      });
  }, [isOrganizrSso, ssoChecked, callbackUrl, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error(errorMessages[result.error] ?? errorMessages.Default);
        return;
      }
      window.location.href = callbackUrl ?? "/search";
    } catch {
      toast.error(t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (isOrganizrSso) {
    return (
      <div className="nv-card p-6 text-center space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("auth.organizrChecking")}
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {organizrCookie ? t("auth.organizrNoSession") : t("auth.organizrLoginFirst")}
            </p>
            {!organizrCookie && (
              <p className="text-xs text-muted-foreground">{t("auth.organizrSsoHint")}</p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="nv-card p-6">
      {authModeLabel && (
        <p className="text-xs text-muted-foreground mb-4 text-center">
          {t("auth.authVia", { provider: authModeLabel })}
        </p>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="nv-label">{t("auth.username")}</label>
          <input
            className="nv-input w-full"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("auth.usernamePlaceholder")}
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <label className="nv-label">{t("auth.password")}</label>
          <input
            className="nv-input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.passwordPlaceholder")}
            required
            autoComplete="current-password"
          />
          <p className="text-xs text-right">
            <Link
              href="/forgot-password"
              tabIndex={-1}
              className="text-primary hover:underline"
            >
              {t("auth.forgotPassword")}
            </Link>
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>
    </div>
  );
}
