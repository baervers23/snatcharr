import GrabsView from "@/components/grabs/GrabsView";
import { auth } from "@/auth";

export const metadata = { title: "Grabs | Snatcharr" };

export default async function GrabsPage() {
  const session = await auth();
  return <GrabsView isAdmin={session?.user?.role === "admin"} userId={session!.user.id} />;
}
