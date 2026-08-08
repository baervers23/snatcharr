import { auth } from "@/auth";
import { isSetupComplete } from "@/lib/setup-status";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!(await isSetupComplete())) {
    redirect("/setup");
  }

  const session = await auth();
  if (session?.user) {
    redirect("/search");
  }

  redirect("/login");
}
