"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, UserPlus, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SIGNUP_PASSWORD_HINT,
  isValidSignupEmail,
  meetsSignupPassword,
} from "@/lib/password-policy";

interface SignupFormProps {
  requireEmail?: boolean;
}

export default function SignupForm({ requireEmail = false }: SignupFormProps) {
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
      toast.error("Passwords do not match");
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
        toast.error(data.error ?? "Registration failed");
        return;
      }

      if (data.verificationEmailSent && email.trim()) {
        setSentToEmail(email.trim());
        setVerificationSent(true);
        return;
      }

      toast.success(data.message ?? "Account created — please sign in");
      window.location.href = "/login";
    } catch {
      toast.error("Registration failed");
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
        <h2 className="text-lg font-semibold">Verify your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to{" "}
          <span className="text-foreground font-medium">{sentToEmail}</span>.
          Please check your inbox and confirm your address before signing in.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Go to sign in
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
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <label className="nv-label">Password</label>
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
            {SIGNUP_PASSWORD_HINT}
          </p>
        </div>
        <div className="space-y-2">
          <label className="nv-label">Confirm password</label>
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
          <label className="nv-label">Email{requireEmail ? " *" : " (optional)"}</label>
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
          {loading ? "Creating account…" : "Sign Up"}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
