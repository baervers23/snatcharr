import { redirect } from "next/navigation";
import Image from "next/image";
import { getConfig } from "@/lib/config";
import { getSetting } from "@/lib/db/settings";
import SignupForm from "@/components/auth/SignupForm";
import { auth } from "@/auth";
import { isSetupComplete } from "@/lib/setup-status";

export const metadata = { title: "Sign Up | Snatcharr" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect("/search");

  const config = getConfig();
  if (!(await isSetupComplete())) redirect("/setup");

  const signupEnabled = await getSetting("signupEnabled");
  if (!signupEnabled) redirect("/login");
  const requireEmail = await getSetting("requireEmail");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center justify-center gap-4 mb-3">
            <Image src="/logo.png" alt="Snatcharr logo" width={96} height={96} className="rounded-2xl" priority />
            <h1 className="text-2xl font-bold">{config.instanceName}</h1>
          </div>
          <p className="text-sm text-muted-foreground">Create your account</p>
        </div>
        <SignupForm requireEmail={requireEmail} />
      </div>
    </div>
  );
}
