import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import type { Grab } from "./db/schema";
import { getSetting } from "./db/settings";
import { isMailConfigured, sendMail } from "./mail";
import { formatBytes } from "./utils";
import { logAction, logActionFail } from "./audit";
import {
  DEFAULT_GRAB_EMAIL_BODY,
  DEFAULT_GRAB_EMAIL_SUBJECT,
  formatGrabPasswordBlock,
  markdownToEmailHtml,
  renderGrabEmailTemplate,
} from "./email-template";

export async function notifyGrabCompleted(
  grab: Pick<Grab, "id" | "userId" | "title" | "sizeBytes" | "downloadedBytes" | "nzbPassword">,
): Promise<void> {
  if (!(await isMailConfigured())) return;

  const user = await db.query.users.findFirst({
    where: eq(users.id, grab.userId),
    columns: { email: true, emailNotifications: true, username: true },
  });

  const email = user?.email?.trim();
  if (!email || !user?.emailNotifications) return;

  const [instanceName, hostUrl, subjectTpl, bodyTpl] = await Promise.all([
    getSetting("instanceName"),
    getSetting("hostUrl"),
    getSetting("grabEmailSubject"),
    getSetting("grabEmailBody"),
  ]);

  const size = formatBytes(grab.downloadedBytes ?? grab.sizeBytes ?? 0);
  const grabsUrl = `${hostUrl.replace(/\/$/, "")}/grabs`;
  const pwd = formatGrabPasswordBlock(grab.nzbPassword);
  const vars = {
    user: user.username,
    requestedgrab: grab.title,
    grablink: grabsUrl,
    size,
    instance: instanceName,
    password: pwd.password,
    passwordblock: pwd.passwordblock,
  };

  const subject = renderGrabEmailTemplate(
    subjectTpl?.trim() || DEFAULT_GRAB_EMAIL_SUBJECT,
    vars,
  );
  const bodyMd = renderGrabEmailTemplate(
    bodyTpl?.trim() || DEFAULT_GRAB_EMAIL_BODY,
    vars,
  );
  const text = bodyMd.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[(.+?)\]\((.+?)\)/g, "$2");
  const html = markdownToEmailHtml(bodyMd);

  const result = await sendMail({ to: email, subject, text, html });
  if (result.ok) {
    logAction({
      domain: "MAIL",
      action: "notify",
      outcome: "ok",
      username: user.username,
      details: `grab ready — "${grab.title}"`,
    });
  } else {
    logActionFail("MAIL", "notify", "failed", {
      username: user.username,
      details: `"${grab.title}"`,
      error: result.error,
    });
  }
}
