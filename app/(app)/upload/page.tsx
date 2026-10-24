import { redirect } from "next/navigation";
import { auth } from "@/auth";
import UploadNzbView from "@/components/upload/UploadNzbView";
import {
  getDownloadCountToday,
  getManualNzbCountToday,
} from "@/lib/daily-usage";
import {
  effectiveDownloadLimitPerDay,
  effectiveManualNzbLimitPerDay,
  userCanUploadNzb,
} from "@/lib/grants";
import { getSetting } from "@/lib/db/settings";
import {
  DEFAULT_UPLOAD_NZB_SITES,
  DEFAULT_UPLOAD_NZB_TIPS,
} from "@/lib/db/settings-shared";

export const metadata = { title: "Upload NZB | Snatcharr" };

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const grant = await userCanUploadNzb(session.user.id, session.user.role);
  if (!grant.allowed) redirect("/search");

  const [
    manualUsed,
    manualMax,
    downloadUsed,
    downloadMax,
    sitesHeading,
    sitesIntro,
    sites,
    tipsHeading,
    tips,
  ] = await Promise.all([
    getManualNzbCountToday(session.user.id),
    effectiveManualNzbLimitPerDay(session.user.id),
    getDownloadCountToday(session.user.id),
    effectiveDownloadLimitPerDay(session.user.id),
    getSetting("uploadNzbSitesHeading"),
    getSetting("uploadNzbSitesIntro"),
    getSetting("uploadNzbSites"),
    getSetting("uploadNzbTipsHeading"),
    getSetting("uploadNzbTips"),
  ]);

  return (
    <UploadNzbView
      isAdmin={session.user.role === "admin"}
      limits={{
        manualUsed,
        manualMax,
        downloadUsed,
        downloadMax,
      }}
      content={{
        sitesHeading: sitesHeading || "Where to find NZBs?",
        sitesIntro: sitesIntro || "",
        sites: Array.isArray(sites) && sites.length > 0 ? sites : DEFAULT_UPLOAD_NZB_SITES,
        tipsHeading: tipsHeading || "Tips for better search results",
        tips: Array.isArray(tips) && tips.length > 0 ? tips : DEFAULT_UPLOAD_NZB_TIPS,
      }}
    />
  );
}
