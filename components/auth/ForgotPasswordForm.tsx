"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export default function ForgotPasswordForm() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = (await response.json()) as { error?: string; message?: string; redirect?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Request failed");
        return;
      }

      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }

      setMessage(
        data.message ??
          "Check your inbox — we sent a password reset link so you can recover your account.",
      );
      setSubmitted(true);
    } catch {
      toast.error("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="nv-card p-6 space-y-4 text-center">
        <p className="text-sm text-foreground">{message}</p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="nv-card p-6">
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

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {loading ? "Sending…" : "Reset password"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-4">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
