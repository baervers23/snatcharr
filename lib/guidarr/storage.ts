import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  DEFAULT_CONFIG,
  type GuidarrConfig,
  type GuidarrGroup,
  type GuidarrSlide,
  type GuidarrSlideWithHtml,
} from "./types";
import {
  GUIDARR_CONFIG_PATH,
  GUIDARR_DATA_DIR,
  GUIDARR_GROUPS_PATH,
  GUIDARR_UPLOADS_DIR,
  groupDir,
  groupSlideFilePath,
  groupSlidesManifestPath,
} from "./paths";
import { markdownToHtml } from "./markdown";

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function ensureGuidarrDataDir(): Promise<void> {
  await ensureDir(GUIDARR_DATA_DIR);
  await ensureDir(GUIDARR_UPLOADS_DIR);
}

export async function getConfig(): Promise<GuidarrConfig> {
  await ensureGuidarrDataDir();
  return readJson(GUIDARR_CONFIG_PATH, { ...DEFAULT_CONFIG });
}

export async function saveConfig(config: GuidarrConfig): Promise<void> {
  await writeJson(GUIDARR_CONFIG_PATH, config);
}

export async function getGroups(): Promise<GuidarrGroup[]> {
  await ensureGuidarrDataDir();
  const groups = await readJson<GuidarrGroup[]>(GUIDARR_GROUPS_PATH, []);
  return groups.sort((a, b) => a.order - b.order);
}

export async function saveGroups(groups: GuidarrGroup[]): Promise<void> {
  await writeJson(GUIDARR_GROUPS_PATH, groups);
}

export async function getGroup(groupId: string): Promise<GuidarrGroup | null> {
  const groups = await getGroups();
  return groups.find((g) => g.id === groupId) ?? null;
}

async function readSlidesManifest(groupId: string): Promise<GuidarrSlide[]> {
  const manifestPath = groupSlidesManifestPath(groupId);
  const slides = await readJson<GuidarrSlide[]>(manifestPath, []);
  return slides.sort((a, b) => a.order - b.order);
}

async function writeSlidesManifest(groupId: string, slides: GuidarrSlide[]): Promise<void> {
  await writeJson(groupSlidesManifestPath(groupId), slides);
}

export async function getSlides(groupId: string): Promise<GuidarrSlide[]> {
  return readSlidesManifest(groupId);
}

export async function getSlidesWithHtml(groupId: string): Promise<GuidarrSlideWithHtml[]> {
  const slides = await readSlidesManifest(groupId);
  const result: GuidarrSlideWithHtml[] = [];

  for (const slide of slides) {
    const filePath = groupSlideFilePath(groupId, slide.id);
    let markdown = "";
    try {
      markdown = await fs.readFile(filePath, "utf-8");
    } catch {
      markdown = `# ${slide.title}\n\nNo content yet.`;
    }
    const html = await markdownToHtml(markdown);
    result.push({ ...slide, html, markdown });
  }

  return result;
}

export async function getSlide(
  groupId: string,
  slideId: string,
): Promise<(GuidarrSlide & { markdown: string }) | null> {
  const slides = await readSlidesManifest(groupId);
  const slide = slides.find((s) => s.id === slideId);
  if (!slide) return null;

  const filePath = groupSlideFilePath(groupId, slide.id);
  let markdown = "";
  try {
    markdown = await fs.readFile(filePath, "utf-8");
  } catch {
    markdown = "";
  }

  return { ...slide, markdown };
}

export async function createGroup(name: string, icon: string | null = null): Promise<GuidarrGroup> {
  const groups = await getGroups();
  const maxOrder = groups.reduce((max, g) => Math.max(max, g.order), -1);
  const group: GuidarrGroup = {
    id: randomUUID(),
    name,
    icon,
    order: maxOrder + 1,
  };

  await ensureDir(groupDir(group.id));
  await ensureDir(path.join(groupDir(group.id), "slides"));
  await writeSlidesManifest(group.id, []);
  groups.push(group);
  await saveGroups(groups);
  return group;
}

export async function updateGroup(
  groupId: string,
  updates: Partial<Pick<GuidarrGroup, "name" | "icon" | "order">>,
): Promise<GuidarrGroup | null> {
  const groups = await getGroups();
  const index = groups.findIndex((g) => g.id === groupId);
  if (index === -1) return null;

  groups[index] = { ...groups[index], ...updates };
  await saveGroups(groups);
  return groups[index];
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  const groups = await getGroups();
  const filtered = groups.filter((g) => g.id !== groupId);
  if (filtered.length === groups.length) return false;

  await saveGroups(filtered);
  try {
    await fs.rm(groupDir(groupId), { recursive: true, force: true });
  } catch {
    /* group folder may not exist */
  }
  return true;
}

export async function reorderGroups(orderedIds: string[]): Promise<GuidarrGroup[]> {
  const groups = await getGroups();
  const map = new Map(groups.map((g) => [g.id, g]));
  const reordered: GuidarrGroup[] = [];

  orderedIds.forEach((id, index) => {
    const group = map.get(id);
    if (group) {
      reordered.push({ ...group, order: index });
      map.delete(id);
    }
  });

  for (const remaining of map.values()) {
    reordered.push({ ...remaining, order: reordered.length });
  }

  await saveGroups(reordered);
  return reordered;
}

export async function createSlide(
  groupId: string,
  title: string,
  markdown = "",
): Promise<GuidarrSlide | null> {
  const group = await getGroup(groupId);
  if (!group) return null;

  const slides = await readSlidesManifest(groupId);
  const maxOrder = slides.reduce((max, s) => Math.max(max, s.order), -1);
  const slide: GuidarrSlide = {
    id: randomUUID(),
    title,
    order: maxOrder + 1,
    redirectUrl: null,
  };

  await ensureDir(path.join(groupDir(groupId), "slides"));
  await fs.writeFile(
    groupSlideFilePath(groupId, slide.id),
    markdown || `# ${title}\n\nStart writing your guide here.`,
    "utf-8",
  );
  slides.push(slide);
  await writeSlidesManifest(groupId, slides);
  return slide;
}

export async function updateSlide(
  groupId: string,
  slideId: string,
  updates: Partial<Pick<GuidarrSlide, "title" | "redirectUrl">> & { markdown?: string },
): Promise<GuidarrSlide | null> {
  const slides = await readSlidesManifest(groupId);
  const index = slides.findIndex((s) => s.id === slideId);
  if (index === -1) return null;

  const { markdown, ...meta } = updates;
  slides[index] = { ...slides[index], ...meta };

  if (markdown !== undefined) {
    await fs.writeFile(groupSlideFilePath(groupId, slideId), markdown, "utf-8");
  }

  await writeSlidesManifest(groupId, slides);
  return slides[index];
}

export async function deleteSlide(groupId: string, slideId: string): Promise<boolean> {
  const slides = await readSlidesManifest(groupId);
  const filtered = slides.filter((s) => s.id !== slideId);
  if (filtered.length === slides.length) return false;

  await writeSlidesManifest(groupId, filtered);
  try {
    await fs.unlink(groupSlideFilePath(groupId, slideId));
  } catch {
    /* file may not exist */
  }
  return true;
}

export async function reorderSlides(groupId: string, orderedIds: string[]): Promise<GuidarrSlide[]> {
  const slides = await readSlidesManifest(groupId);
  const map = new Map(slides.map((s) => [s.id, s]));
  const reordered: GuidarrSlide[] = [];

  orderedIds.forEach((id, index) => {
    const slide = map.get(id);
    if (slide) {
      reordered.push({ ...slide, order: index });
      map.delete(id);
    }
  });

  for (const remaining of map.values()) {
    reordered.push({ ...remaining, order: reordered.length });
  }

  await writeSlidesManifest(groupId, reordered);
  return reordered;
}

/** Seed demo content on first setup so the main page is not empty. */
export async function seedDefaultContent(): Promise<void> {
  const groups = await getGroups();
  if (groups.length > 0) return;

  const welcome = await createGroup("Getting Started", null);
  if (!welcome) return;

  await createSlide(
    welcome.id,
    "Welcome to Guidarr",
    `# Welcome to Guidarr\n\nYour guided walkthrough app is ready.\n\n- Use the **Admin** area to add groups and slides\n- Each group appears as a tab in the navbar\n- Slides stack on top of the main background`,
  );

  await createSlide(
    welcome.id,
    "Next Steps",
    `## Customize your guide\n\n1. Open **Admin** and set a background image or color\n2. Create new groups for different topics\n3. Add markdown slides with live preview\n4. Set redirect URLs to jump when a slide becomes active`,
  );
}
