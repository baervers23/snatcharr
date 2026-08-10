import { Suspense } from "react";
import Image from "next/image";
import { getConfig } from "@/lib/config";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Reset Password | Snatcharr" };

export default function ResetPasswordPage() {
  const config = getConfig();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center gap-4 mb-3">
            <Image src="/logo.png" alt="Snatcharr logo" width={96} height={96} className="rounded-2xl" priority />
            <h1 className="text-2xl font-bold">{config.instanceName}</h1>
          </div>
          <p className="text-sm text-muted-foreground">Choose a new password</p>
        </div>
        <Suspense fallback={<div className="nv-card p-6 text-center text-sm text-muted-foreground">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
