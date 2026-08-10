import SearchView from "@/components/search/SearchView";
import { auth } from "@/auth";
import { getSetting } from "@/lib/db/settings";
import { userCanPickDownloader } from "@/lib/grants";

export const metadata = { title: "Search | Snatcharr" };

export default async function SearchPage() {
  const session = await auth();
  const enabledCategories = await getSetting("enabledCategories");
  const canPickDownloader = session?.user
    ? await userCanPickDownloader(session.user.id, session.user.role)
    : false;
  return (
    <SearchView
      isAdmin={session?.user?.role === "admin"}
      canPickDownloader={canPickDownloader}
      enabledCategories={enabledCategories}
    />
  );
}
