import { redirect } from "next/navigation";
import { getSetting } from "@/lib/db/settings";
import SetupWizard from "@/components/setup/SetupWizard";

export const metadata = { title: "Setup | Snatcharr" };

export default async function SetupPage() {
  const setupCompleted = await getSetting("setupCompleted");
  if (setupCompleted) {
    redirect("/search");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SetupWizard />
    </div>
  );
}
