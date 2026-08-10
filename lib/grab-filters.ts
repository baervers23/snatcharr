import { getSetting } from "./db/settings";
import type { ExtensionSizeLimit } from "./db/settings-shared";
import { logActionFail } from "./audit";

export interface GrabFilterInput {
  title: string;
  sizeBytes?: number;
  category?: string;
  categoryId?: number;
  url?: string;
}

export interface GrabFilterSettings {
  extensionLimitsEnabled: boolean;
  extensionLimits: ExtensionSizeLimit[];
  titleBlacklist: string[];
  domainBlacklist: string[];
}

export async function loadGrabFilterSettings(): Promise<GrabFilterSettings> {
  const [extensionLimitsEnabled, extensionLimits, titleBlacklist, domainBlacklist] = await Promise.all([
    getSetting("grabFilterExtensionLimitsEnabled"),
    getSetting("grabFilterExtensionLimits"),
    getSetting("grabFilterTitleBlacklist"),
    getSetting("grabFilterDomainBlacklist"),
  ]);
  return {
    extensionLimitsEnabled: extensionLimitsEnabled ?? true,
    extensionLimits: extensionLimits ?? [],
    titleBlacklist: titleBlacklist ?? [],
    domainBlacklist: domainBlacklist ?? [],
  };
}

function normalizeList(items: string[]): string[] {
  return items.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function normalizeExt(ext: string): string {
  const t = ext.trim().toLowerCase();
  if (!t) return "";
  return t.startsWith(".") ? t : `.${t}`;
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** First matching extension rule found in the release title. */
export function matchingExtensionRule(
  title: string,
  rules: ExtensionSizeLimit[],
): ExtensionSizeLimit | null {
  const lower = title.toLowerCase();
  for (const rule of rules) {
    const ext = normalizeExt(rule.ext);
    if (!ext) continue;
    if (lower.includes(ext)) return { ...rule, ext };
  }
  return null;
}

export function evaluateGrabFilter(
  input: GrabFilterInput,
  rules: GrabFilterSettings,
): { allowed: true } | { allowed: false; reason: string; rule: string } {
  const titleLower = input.title.toLowerCase();

  for (const term of normalizeList(rules.titleBlacklist)) {
    if (titleLower.includes(term)) {
      return {
        allowed: false,
        reason: `Title matches blocked term "${term}"`,
        rule: "title-blacklist",
      };
    }
  }

  if (input.url?.trim()) {
    const host = hostFromUrl(input.url.trim());
    if (host) {
      for (const domain of normalizeList(rules.domainBlacklist)) {
        if (host === domain || host.endsWith(`.${domain}`)) {
          return {
            allowed: false,
            reason: `URL domain "${host}" is blocked`,
            rule: "domain-blacklist",
          };
        }
      }
    }
  }

  const extRule =
    rules.extensionLimitsEnabled
      ? matchingExtensionRule(input.title, rules.extensionLimits)
      : null;
  if (extRule && input.sizeBytes != null && input.sizeBytes > 0) {
    if (extRule.minBytes > 0 && input.sizeBytes < extRule.minBytes) {
      return {
        allowed: false,
        reason: `${extRule.ext}: size below minimum`,
        rule: "ext-size-min",
      };
    }
    if (extRule.maxBytes > 0 && input.sizeBytes > extRule.maxBytes) {
      return {
        allowed: false,
        reason: `${extRule.ext}: size above maximum`,
        rule: "ext-size-max",
      };
    }
  }

  return { allowed: true };
}

export async function checkGrabAllowed(
  input: GrabFilterInput,
  opts: {
    username?: string;
    source: "search" | "manual";
    req?: Request;
  },
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const rules = await loadGrabFilterSettings();
  const result = evaluateGrabFilter(input, rules);
  if (result.allowed) return result;

  logActionFail("FILTER", opts.source, "denied", {
    username: opts.username,
    details: `${result.rule}: ${result.reason} — "${input.title}"`,
    req: opts.req,
  });
  return { allowed: false, reason: result.reason };
}
