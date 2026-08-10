export type ActionOutcome = "ok" | "failed" | "denied" | "aborted";

export function parseActionLine(msg: string): {
  domain?: string;
  action?: string;
  outcome?: ActionOutcome;
  rest: string;
} {
  const m = msg.match(
    /^\[([A-Z][A-Z0-9_]*)\]\s+(\S+)\s+(ok|failed|denied|aborted)(?:\s+(.*))?$/,
  );
  if (!m) return { rest: msg };
  return {
    domain: m[1],
    action: m[2],
    outcome: m[3] as ActionOutcome,
    rest: m[4] ?? "",
  };
}

export const DOMAIN_COLORS: Record<string, string> = {
  AUTH: "text-purple-400",
  GRAB: "text-cyan-400",
  SEARCH: "text-blue-400",
  USER: "text-green-400",
  SYNC: "text-teal-400",
  SETTINGS: "text-amber-400",
  MAIL: "text-pink-400",
  TASK: "text-orange-400",
  FILTER: "text-rose-400",
  SETUP: "text-indigo-400",
};

export const OUTCOME_COLORS: Record<ActionOutcome, string> = {
  ok: "text-green-400",
  failed: "text-red-400",
  denied: "text-yellow-400",
  aborted: "text-yellow-300",
};
