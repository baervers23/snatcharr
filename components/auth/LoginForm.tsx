"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
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
const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid username or password",
  SessionRequired: "You must be signed in to access this page",
  Default: "An error occurred. Please try again.",
};
export default function LoginForm({
  callbackUrl,
  error,
  authModeLabel,
  authMethod,
  verified,
}: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ssoChecked, setSsoChecked] = useState(false);
  const [organizrCookie] = useState(() =>
    authMethod === "organizr-sso" ? getOrganizrTokenCookie() : null,
  );
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default) : null;
  const isOrganizrSso = authMethod === "organizr-sso";
  useEffect(() => {
    if (verified) {
      toast.success("Email verified — you can sign in now");
    }
  }, [verified]);
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
          toast.error(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default);
          return;
        }
        window.location.href = callbackUrl ?? "/search";
      })
      .catch(() => {
        toast.error("Organizr SSO login failed");
      })
      .finally(() => {
        setLoading(false);
        setSsoChecked(true);
      });
  }, [isOrganizrSso, ssoChecked, callbackUrl]);
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
        toast.error(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default);
        return;
      }
      window.location.href = callbackUrl ?? "/search";
    } catch {
      toast.error("Login failed. Please try again.");
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
            Checking Organizr session…
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {organizrCookie
                ? "No valid Organizr session found."
                : "Log in to Organizr first (same browser), then open Snatcharr again."}
            </p>
            {!organizrCookie && (
              <p className="text-xs text-muted-foreground">
                SSO requires the Organizr cookie on a shared parent domain or reverse-proxy setup.
              </p>
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
          Authentication via {authModeLabel}
        </p>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="nv-label">Username</label>
          <input
            className="nv-input w-full"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <label className="nv-label">Password</label>
          <input
            className="nv-input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
          <p className="text-xs text-right">
            <Link
              href="/forgot-password"
              tabIndex={-1}
              className="text-primary hover:underline"
            >
              Forgot password?
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
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
