import SetupWizard from "@/components/setup/SetupWizard";
import { getSetupPrefillData } from "@/lib/setup-prefill";
import { getSetupPageStatus, isSetupComplete } from "@/lib/setup-status";
import { redirect } from "next/navigation";

export const metadata = { title: "Setup | Snatcharr" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupComplete()) {
    redirect("/login");
  }

  const [prefill, setupStatus] = await Promise.all([getSetupPrefillData(), getSetupPageStatus()]);
  return <SetupWizard prefill={prefill} setupStatus={setupStatus} />;
}
