import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSetting } from "@/lib/db/settings";

export default async function RootPage() {
  const setupCompleted = await getSetting("setupCompleted");
  if (!setupCompleted) {
    redirect("/setup");
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  redirect("/search");
}
