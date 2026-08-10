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

export const metadata = { title: "Upload NZB | Snatcharr" };

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const grant = await userCanUploadNzb(session.user.id, session.user.role);
  if (!grant.allowed) redirect("/search");

  const [manualUsed, manualMax, downloadUsed, downloadMax] = await Promise.all([
    getManualNzbCountToday(session.user.id),
    effectiveManualNzbLimitPerDay(session.user.id),
    getDownloadCountToday(session.user.id),
    effectiveDownloadLimitPerDay(session.user.id),
  ]);

  return (
    <UploadNzbView
      limits={{
        manualUsed,
        manualMax,
        downloadUsed,
        downloadMax,
      }}
    />
  );
}
