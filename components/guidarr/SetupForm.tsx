"use client";

import { LOCAL_STORAGE_ADMIN_KEY } from "@/lib/guidarr/types";
import { cn } from "@/lib/utils";
import { BookOpen, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Mode = "loading" | "create" | "restore";

export default function SetupForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/guidarr/setup")
      .then((r) => r.json())
      .then((data: { setupComplete: boolean }) => {
        setMode(data.setupComplete ? "restore" : "create");
      })
      .catch(() => setMode("create"));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/guidarr/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Setup failed");
      }

      localStorage.setItem(LOCAL_STORAGE_ADMIN_KEY, password);
      toast.success("Guidarr is ready!");
      router.replace("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/guidarr/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        toast.error("Invalid password");
        return;
      }

      localStorage.setItem(LOCAL_STORAGE_ADMIN_KEY, password);
      toast.success("Welcome back!");
      router.replace("/");
    } catch {
      toast.error("Could not verify password");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isRestore = mode === "restore";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 shadow-lg">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isRestore ? "Welcome Back" : "Welcome to Guidarr"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRestore
              ? "Enter your admin password to restore access on this device."
              : "Create your admin password to get started with your guided walkthrough."}
          </p>
        </div>

        <form
          onSubmit={isRestore ? handleRestore : handleCreate}
          className="rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={isRestore ? "Your admin password" : "Min. 6 characters"}
                  required
                  autoComplete={isRestore ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {!isRestore ? (
              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium text-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Repeat password"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition",
              loading ? "opacity-70" : "hover:opacity-90",
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isRestore ? "Continue" : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
