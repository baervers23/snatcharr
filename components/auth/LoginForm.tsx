"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";

interface LoginFormProps {
  callbackUrl?: string;
  error?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid username or password",
  SessionRequired: "You must be signed in to access this page",
  Default: "An error occurred. Please try again.",
};

export default function LoginForm({ callbackUrl, error }: LoginFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default) : null;

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

      router.push(callbackUrl ?? "/search");
      router.refresh();
    } catch {
      toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nv-card p-6">
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
