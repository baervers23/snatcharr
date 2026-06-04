import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginForm from "@/components/auth/LoginForm";
import { getSetting } from "@/lib/db/settings";
import { Shield } from "lucide-react";

export const metadata = { title: "Login | Snatcharr" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    redirect(params.callbackUrl ?? "/search");
  }

  const setupCompleted = await getSetting("setupCompleted");
  if (!setupCompleted) {
    redirect("/setup");
  }

  const instanceName = await getSetting("instanceName");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">{instanceName}</h1>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <LoginForm callbackUrl={params.callbackUrl} error={params.error} />

        <p className="text-center text-xs text-muted-foreground mt-6">
          Access restricted to authorized users only.
        </p>
      </div>
    </div>
  );
}
