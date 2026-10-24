import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { grabs, users } from "@/lib/db/schema";
import { setManySettings } from "@/lib/db/settings";
import { getDownloadDir } from "@/lib/paths";

export const DEBUG_USER_USERNAME = "debug-user";
export const DEBUG_USER_PASSWORD = "debug-user-pass";
export const DEBUG_GRAB_TITLE = "[DEBUG] Sample Completed Grab";

export async function seedDebugUser() {
  const existing = await db.query.users.findFirst({
    where: eq(users.username, DEBUG_USER_USERNAME),
  });
  if (existing) {
    return {
      id: existing.id,
      username: existing.username,
      password: DEBUG_USER_PASSWORD,
      created: false,
    };
  }

  const passwordHash = await bcrypt.hash(DEBUG_USER_PASSWORD, 12);
  const [created] = await db
    .insert(users)
    .values({
      username: DEBUG_USER_USERNAME,
      email: null,
      passwordHash,
      role: "user",
      canGrab: true,
      canDownload: true,
      canUploadNzb: true,
      isActive: true,
      maxGrabsPerDay: 50,
      maxDownloadsPerDay: 50,
    })
    .returning();

  return {
    id: created.id,
    username: created.username,
    password: DEBUG_USER_PASSWORD,
    created: true,
  };
}

function writeSampleFile(dir: string, name: string, sizeBytes: number) {
  const filePath = path.join(dir, name);
  const chunk = Buffer.alloc(64 * 1024, 0x61); // 'a'
  const fd = fs.openSync(filePath, "w");
  let written = 0;
  while (written < sizeBytes) {
    const n = Math.min(chunk.length, sizeBytes - written);
    fs.writeSync(fd, chunk, 0, n);
    written += n;
  }
  fs.closeSync(fd);
  return filePath;
}

export async function seedDebugGrab(ownerUserId: string) {
  const existing = await db.query.grabs.findFirst({
    where: eq(grabs.title, DEBUG_GRAB_TITLE),
  });

  const downloadBase = getDownloadDir();
  if (!fs.existsSync(downloadBase)) fs.mkdirSync(downloadBase, { recursive: true });

  const folderName = "debug-sample-grab";
  const storagePath = path.join(downloadBase, folderName);
  if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });

  const sampleFile = writeSampleFile(storagePath, "sample-video.mkv", 2 * 1024 * 1024);
  writeSampleFile(storagePath, "readme.txt", 256);

  if (existing) {
    await db
      .update(grabs)
      .set({
        userId: ownerUserId,
        status: "completed",
        progress: 100,
        storagePath,
        archivePath: storagePath,
        sizeBytes: 2 * 1024 * 1024 + 256,
        completedAt: new Date(),
        downloadClientStatus: "Completed",
        downloadClientMessage: "Debug seed",
      })
      .where(eq(grabs.id, existing.id));
    return { id: existing.id, title: DEBUG_GRAB_TITLE, storagePath, sampleFile, created: false };
  }

  const [created] = await db
    .insert(grabs)
    .values({
      userId: ownerUserId,
      title: DEBUG_GRAB_TITLE,
      indexerName: "Debug Mock Indexer",
      category: "TV/HD",
      categoryId: 5040,
      sizeBytes: 2 * 1024 * 1024 + 256,
      source: "manual",
      status: "completed",
      progress: 100,
      storagePath,
      archivePath: storagePath,
      completedAt: new Date(),
      downloadClientStatus: "Completed",
      downloadClientMessage: "Debug seed",
      isPublic: false,
    })
    .returning();

  return { id: created.id, title: DEBUG_GRAB_TITLE, storagePath, sampleFile, created: true };
}

export async function applyNoticePreset() {
  await setManySettings({
    infoPopupMode: "always",
    infoPopupTitle: "Debug Notice",
    infoPopupText:
      "This is a debug disclaimer.\n\nUse System → Debug to change language, speed limit, and mocks.",
    infoPopupEnabled: true,
  });
}

export async function applySpeedLimitPreset(mbit = 1) {
  await setManySettings({ userDownloadSpeedLimitMbit: mbit });
}

export async function getDebugSeedStatus() {
  const user = await db.query.users.findFirst({
    where: eq(users.username, DEBUG_USER_USERNAME),
    columns: { id: true, username: true, isActive: true },
  });
  const grab = await db.query.grabs.findFirst({
    where: eq(grabs.title, DEBUG_GRAB_TITLE),
    columns: { id: true, status: true, storagePath: true },
  });
  const grabDirExists = !!(grab?.storagePath && fs.existsSync(grab.storagePath));
  return {
    user: user
      ? { id: user.id, username: user.username, active: !!user.isActive }
      : null,
    grab: grab
      ? { id: grab.id, status: grab.status, filesOk: grabDirExists }
      : null,
  };
}

export async function cleanupDebugSeeds() {
  const grab = await db.query.grabs.findFirst({
    where: eq(grabs.title, DEBUG_GRAB_TITLE),
  });
  if (grab) {
    if (grab.storagePath && fs.existsSync(grab.storagePath)) {
      fs.rmSync(grab.storagePath, { recursive: true, force: true });
    }
    await db.delete(grabs).where(eq(grabs.id, grab.id));
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, DEBUG_USER_USERNAME),
  });
  if (user) {
    await db.delete(users).where(eq(users.id, user.id));
  }

  return { cleaned: true };
}
