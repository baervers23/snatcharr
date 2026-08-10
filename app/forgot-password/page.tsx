import Image from "next/image";
import { getConfig } from "@/lib/config";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Forgot Password | Snatcharr" };

export default function ForgotPasswordPage() {
  const config = getConfig();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center gap-4 mb-3">
            <Image src="/logo.png" alt="Snatcharr logo" width={96} height={96} className="rounded-2xl" priority />
            <h1 className="text-2xl font-bold">{config.instanceName}</h1>
          </div>
          <p className="text-sm text-muted-foreground">Recover your account</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
