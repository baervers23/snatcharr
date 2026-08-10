export const GRAB_EMAIL_VARIABLES = [
  { key: "$user", label: "Username" },
  { key: "$requestedgrab", label: "Grab title" },
  { key: "$grablink", label: "Link to grabs page" },
  { key: "$link", label: "Alias for grab link" },
  { key: "$size", label: "File size" },
  { key: "$password", label: "NZB/archive password (empty if none)" },
  { key: "$passwordblock", label: "Password paragraph (empty if none)" },
] as const;

export const DEFAULT_GRAB_EMAIL_SUBJECT = "[$instance] Download ready: $requestedgrab";

export const DEFAULT_GRAB_EMAIL_BODY = `Hi $user,

Your download **$requestedgrab** ($size) is ready.

$passwordblock
Browse or download your files here: $grablink`;

export interface GrabEmailVars {
  user: string;
  requestedgrab: string;
  grablink: string;
  size: string;
  instance?: string;
  password?: string;
  passwordblock?: string;
}

/** Plain password or empty — also written to password.txt in the grab folder. */
export function formatGrabPasswordBlock(password: string | null | undefined): {
  password: string;
  passwordblock: string;
} {
  const pwd = password?.trim() ?? "";
  if (!pwd) {
    return { password: "", passwordblock: "" };
  }
  return {
    password: pwd,
    passwordblock: `Archive password: **${pwd}**\nA copy is also saved as password.txt in your download folder.`,
  };
}

export function renderGrabEmailTemplate(
  template: string,
  vars: GrabEmailVars,
): string {
  const link = vars.grablink;
  const { password, passwordblock } = formatGrabPasswordBlock(vars.password);
  return template
    .replace(/\$instance/g, vars.instance ?? "Snatcharr")
    .replace(/\$user/g, vars.user)
    .replace(/\$requestedgrab/g, vars.requestedgrab)
    .replace(/\$grablink/g, link)
    .replace(/\$link/g, link)
    .replace(/\$size/g, vars.size)
    .replace(/\$passwordblock/g, vars.passwordblock ?? passwordblock)
    .replace(/\$password/g, vars.password ?? password)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Minimal markdown → HTML for email bodies. */
export function markdownToEmailHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  let html = escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1">$1</a>',
    );

  html = html
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return html;
}
