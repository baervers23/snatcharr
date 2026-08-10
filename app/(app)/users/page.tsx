import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, grabs } from "@/lib/db/schema";
import { eq, count, and, gte } from "drizzle-orm";
import UsersView from "@/components/users/UsersView";

export const metadata = { title: "Users | Snatcharr" };

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/search");

  const userList = await db.query.users.findMany({
    orderBy: (t, { asc }) => [asc(t.username)],
  });

  return <UsersView users={userList} currentUserId={session.user.id} />;
}
