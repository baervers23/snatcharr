import ProfileView from "@/components/profile/ProfileView";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSetting } from "@/lib/db/settings";
import {
  getDownloadCountToday,
  getGlobalGrabCountToday,
  getGlobalSearchCountToday,
  getGrabCountToday,
  getManualNzbCountToday,
} from "@/lib/daily-usage";
import { DAILY_RESET_HOUR, getMsUntilDailyReset } from "@/lib/daily-limits";
import {
  effectiveDownloadLimitPerDay,
  effectiveGrabLimitPerDay,
  effectiveManualNzbLimitPerDay,
  userCanUploadNzb,
} from "@/lib/grants";
export const metadata = { title: "Profile | Snatcharr" };
export default async function ProfilePage() {
  const session = await auth();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session!.user.id),
  });
  const authMethod = await getSetting("authMethod");
  const uploadGrant = await userCanUploadNzb(session!.user.id, session!.user.role);
  const [
    searchUsed,
    grabUsed,
    personalGrabUsed,
    downloadUsed,
    searchMax,
    globalGrabMax,
    grabMax,
    downloadMax,
    manualNzbUsed,
    manualNzbMax,
  ] = await Promise.all([
    getGlobalSearchCountToday(),
    getGlobalGrabCountToday(),
    getGrabCountToday(session!.user.id),
    getDownloadCountToday(session!.user.id),
    getSetting("maxSearchRequestsPerUserPerDay"),
    getSetting("maxGrabsPerUserPerDay"),
    effectiveGrabLimitPerDay(session!.user.id),
    effectiveDownloadLimitPerDay(session!.user.id),
    uploadGrant.allowed ? getManualNzbCountToday(session!.user.id) : Promise.resolve(0),
    uploadGrant.allowed ? effectiveManualNzbLimitPerDay(session!.user.id) : Promise.resolve(0),
  ]);
  return (
    <ProfileView
      username={session!.user.username}
      role={session!.user.role}
      authMethod={authMethod}
      email={user?.email ?? null}
      showGrabsPublic={user?.showGrabsPublic ?? false}
      emailNotifications={user?.emailNotifications ?? false}
      avatarUrl={user?.avatarUrl ?? null}
      canUploadNzb={uploadGrant.allowed}
      limits={{
        searchUsed,
        searchMax,
        grabUsed,
        personalGrabUsed,
        globalGrabMax,
        grabMax,
        downloadUsed,
        downloadMax,
        manualNzbUsed,
        manualNzbMax,
        resetInMs: getMsUntilDailyReset(),
        resetAtHour: DAILY_RESET_HOUR,
      }}
    />
  );
}
