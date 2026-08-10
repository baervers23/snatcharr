import { auth } from "@/auth";
import LoginForm from "@/components/auth/LoginForm";
import { getConfig } from "@/lib/config";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getSetting } from "@/lib/db/settings";
import { AUTH_METHOD_INFO } from "@/lib/auth-methods";
import type { AppSettings } from "@/lib/db/settings-shared";
import { isSetupComplete } from "@/lib/setup-status";

export const metadata = { title: "Login | Snatcharr" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; verified?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session?.user) {
    redirect(params.callbackUrl ?? "/search");
  }

  if (!(await isSetupComplete())) {
    redirect("/setup");
  }

  const config = getConfig();
  const instanceName = config.instanceName;

  const authMethod = await getSetting("authMethod");
  const authModeLabel =
    authMethod === "local"
      ? null
      : AUTH_METHOD_INFO[authMethod as AppSettings["authMethod"]]?.label ?? authMethod;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center gap-4 mb-3">
            <Image
              src="/logo.png"
              alt="Snatcharr logo"
              width={128}
              height={128}
              className="rounded-3xl shadow-lg"
              priority
            />
            <h1 className="text-3xl font-bold">{instanceName}</h1>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <LoginForm
          callbackUrl={params.callbackUrl}
          error={params.error}
          authModeLabel={authModeLabel}
          authMethod={authMethod}
          verified={params.verified === "1"}
        />

        {(await getSetting("signupEnabled")) && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            No account?{" "}
            <a href="/signup" className="text-primary hover:underline">
              Sign up
            </a>
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground mt-4">
          Access restricted to authorized users only.
        </p>
      </div>
    </div>
  );
}
