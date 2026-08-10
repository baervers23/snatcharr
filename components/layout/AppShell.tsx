"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Search,
  Download,
  BarChart2,
  Settings,
  Users,
  Monitor,
  Upload,
  Menu,
  X,
  LogOut,
  User,
  Bell,
  ChevronDown,
  AlertTriangle,
  Loader2,
  HardDrive,
  Github,
} from "lucide-react";
import { APP_VERSION } from "@/lib/app-version";
import { formatTimeUntilReset } from "@/lib/daily-limits";
import { popupDismissStorageKey } from "@/lib/popup-storage";
import { cn, formatBytes } from "@/lib/utils";
import InfoPopup from "./InfoPopup";
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  requiresUpload?: boolean;
}
const NAV_ITEMS: NavItem[] = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/upload", label: "Upload NZB", icon: Upload, requiresUpload: true },
  { href: "/grabs", label: "Grabs", icon: Download },
  { href: "/stats", label: "Stats", icon: BarChart2 },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
  { href: "/system", label: "System", icon: Monitor, adminOnly: true },
];
interface DiskInfo {
  path: string;
  label: string;
  free: number;
  total: number;
}
interface DailyLimits {
  searchUsed: number;
  searchMax: number;
  grabUsed: number;
  personalGrabUsed: number;
  globalGrabMax: number;
  grabMax: number;
  downloadUsed: number;
  downloadMax: number;
  manualNzbUsed?: number;
  manualNzbMax?: number;
  resetInMs: number;
  resetAtHour: number;
}
interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
  checkedAt: string;
  error?: string;
}
interface SystemStatus {
  update?: AppUpdateInfo;
  hasHealthIssues: boolean;
  healthIssues: number;
  activeDownloads: number;
  globalActiveDownloads: number;
  appDisk: DiskInfo | null;
  downloadDisk: DiskInfo | null;
  sameDisk: boolean;
  dailyLimits?: DailyLimits;
}
interface AppShellProps {
  user: { id: string; username: string; role: "admin" | "user" };
  canUploadNzb?: boolean;
  instanceName: string;
  infoPopup: string | null;
  infoPopupMode?: "once" | "always" | "disabled";
  children: React.ReactNode;
}
export default function AppShell({
  user,
  canUploadNzb = false,
  instanceName,
  infoPopup,
  infoPopupMode = "disabled",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [showDiskModal, setShowDiskModal] = useState(false);
  useEffect(() => {
    if (!infoPopup || infoPopupMode === "disabled") return;
    if (infoPopupMode === "always") {
      setShowInfoPopup(true);
      return;
    }
    const key = popupDismissStorageKey(infoPopup);
    if (!sessionStorage.getItem(key)) setShowInfoPopup(true);
  }, [infoPopup, infoPopupMode]);
  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch("/api/system/status");
        if (r.ok) setStatus((await r.json()) as SystemStatus);
      } catch {
        // ignore
      }
    }
    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, []);
  const navItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && user.role !== "admin") return false;
    if (item.requiresUpload && !canUploadNzb) return false;
    return true;
  });
  const isBusy = (status?.activeDownloads ?? 0) > 0;
  function NavLink({ item }: { item: NavItem }) {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    const showHealthDot = item.href === "/system" && user.role === "admin" && status?.hasHealthIssues;
    return (
      <Link href={item.href} className={cn("nav-item", active && "active")} onClick={() => setSidebarOpen(false)}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        {showHealthDot && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Health issues detected" />}
        {item.href === "/grabs" && isBusy && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
      </Link>
    );
  }
  function DiskCard({ disk, title }: { disk: DiskInfo; title: string }) {
    const usedPct = disk.total > 0 ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0;
    return (
      <div className="p-4 border border-border rounded-md space-y-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{disk.path}</p>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full", usedPct > 90 ? "bg-red-500" : usedPct > 75 ? "bg-amber-500" : "bg-primary")} style={{ width: `${usedPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{formatBytes(disk.free)} free of {formatBytes(disk.total)} ({usedPct}% used)</p>
      </div>
    );
  }
  return (
    <div className="h-screen overflow-hidden bg-background flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-56 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200", "lg:translate-x-0 lg:static lg:z-auto", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
          <Image src="/logo.png" alt="Snatcharr" width={40} height={40} className="rounded-xl w-10 h-10 object-contain shrink-0" priority />
          <span className="font-semibold text-foreground truncate text-lg">{instanceName}</span>
          <button className="ml-auto lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}><X className="h-4 w-4" /></button>
        </div>
        <nav className="flex-1 p-3 pt-5 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>
        {user.role === "admin" && status?.appDisk && (
          <div className="px-3 pb-2">
            <button onClick={() => setShowDiskModal(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors">
              <HardDrive className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatBytes(status.appDisk.free)} free</span>
            </button>
          </div>
        )}
        <div className="px-3 pb-2 mt-auto">
          <a
            href={status?.update?.updateAvailable ? status.update.releaseUrl : "https://github.com/baervers23/snatcharr"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 rounded-md border text-xs transition-colors",
              status?.update?.updateAvailable
                ? "border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-primary/10 hover:from-amber-500/25 hover:to-primary/20 text-foreground"
                : "border-sidebar-border bg-gradient-to-r from-sidebar-accent/80 to-primary/10 hover:from-sidebar-accent hover:to-primary/20 text-muted-foreground hover:text-foreground",
            )}
          >
            <Github className="h-4 w-4 shrink-0 text-foreground" />
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-foreground truncate">Snatcharr</span>
              <span className="block text-[10px] opacity-80 truncate">
                {status?.update?.updateAvailable
                  ? `v${status.update.latestVersion} available`
                  : "github.com/baervers23"}
              </span>
            </span>
            {status?.update?.updateAvailable ? (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 animate-pulse">
                Update
              </span>
            ) : (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                v{APP_VERSION}
              </span>
            )}
          </a>
        </div>
        <div className="p-3 border-t border-sidebar-border">
          <div className="relative">
            <button onClick={() => setProfileOpen(!profileOpen)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-sm">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary uppercase">{user.username.charAt(0)}</span>
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform shrink-0", profileOpen && "rotate-180")} />
            </button>
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"><User className="h-4 w-4" />My Profile</Link>
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-destructive"><LogOut className="h-4 w-4" />Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        {status?.hasHealthIssues && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2 text-sm text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Health issues detected — {status.healthIssues} service{status.healthIssues !== 1 ? "s" : ""} may be down or misconfigured.</span>
          </div>
        )}
        {isBusy && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center gap-2 text-xs text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{status?.activeDownloads ?? 0} download{(status?.activeDownloads ?? 0) !== 1 ? "s" : ""} in progress</span>
          </div>
        )}
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3 px-4 sticky top-0 z-20">
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
          <h2 className="text-sm font-medium text-foreground hidden sm:block">
            {NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.label ?? "Snatcharr"}
          </h2>
          <div className="flex-1" />
          {status?.dailyLimits && (
            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground mr-2">
              <span title="Global search limit (resets 11:00 AM)">
                Search{" "}
                <span className="text-foreground font-medium">
                  {status.dailyLimits.searchMax > 0
                    ? `${status.dailyLimits.searchUsed}/${status.dailyLimits.searchMax}`
                    : `${status.dailyLimits.searchUsed} (∞)`}
                </span>
                <span className="text-[10px] ml-0.5 opacity-70">(global)</span>
              </span>
              <span className="text-border">|</span>
              <span title="Global default grab limit (resets 11:00 AM)">
                Grabs{" "}
                <span className="text-foreground font-medium">
                  {status.dailyLimits.globalGrabMax > 0
                    ? `${status.dailyLimits.grabUsed}/${status.dailyLimits.globalGrabMax}`
                    : `${status.dailyLimits.grabUsed} (∞)`}
                </span>
                <span className="text-[10px] ml-0.5 opacity-70">(global)</span>
              </span>
              {status.dailyLimits.grabMax > 0 &&
                status.dailyLimits.grabMax !== status.dailyLimits.globalGrabMax && (
                  <>
                    <span className="text-border">|</span>
                    <span title="Your personal grab limit (resets 11:00 AM)">
                      Grabs{" "}
                      <span className="text-foreground font-medium">
                        {`${status.dailyLimits.personalGrabUsed}/${status.dailyLimits.grabMax}`}
                      </span>
                      <span className="text-[10px] ml-0.5 opacity-70">(you)</span>
                    </span>
                  </>
                )}
              <span className="text-border">|</span>
              <span title="Your personal file download limit (resets 11:00 AM)">
                Downloads{" "}
                <span className="text-foreground font-medium">
                  {status.dailyLimits.downloadMax > 0
                    ? `${status.dailyLimits.downloadUsed}/${status.dailyLimits.downloadMax}`
                    : `${status.dailyLimits.downloadUsed} (∞)`}
                </span>
                <span className="text-[10px] ml-0.5 opacity-70">(you)</span>
              </span>
              {canUploadNzb && (status.dailyLimits.manualNzbMax ?? 0) > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span title="Your personal manual NZB limit (resets 11:00 AM)">
                    NZB{" "}
                    <span className="text-foreground font-medium">
                      {status.dailyLimits.manualNzbUsed ?? 0}/{status.dailyLimits.manualNzbMax}
                    </span>
                    <span className="text-[10px] ml-0.5 opacity-70">(you)</span>
                  </span>
                </>
              )}
              <span className="text-border">|</span>
              <span title={`Resets daily at ${status.dailyLimits.resetAtHour}:00`}>
                Reset in {formatTimeUntilReset(status.dailyLimits.resetInMs)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {infoPopup && (
              <button onClick={() => setShowInfoPopup(true)} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Info"><Bell className="h-4 w-4" /></button>
            )}
            <Link href="/profile" className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors" title="My Profile">
              <span className="text-xs font-semibold text-primary uppercase">{user.username.charAt(0)}</span>
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto animate-fade-in">{children}</main>
      </div>
      {showInfoPopup && infoPopup && (
        <InfoPopup
          text={infoPopup}
          onClose={() => {
            setShowInfoPopup(false);
            if (infoPopupMode === "once") {
              sessionStorage.setItem(popupDismissStorageKey(infoPopup), "1");
            }
          }}
        />
      )}
      {showDiskModal && status?.appDisk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDiskModal(false)}>
          <div className="nv-card w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2"><HardDrive className="h-4 w-4 text-primary" />Disk Space</h2>
              <button onClick={() => setShowDiskModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <DiskCard disk={status.appDisk} title="App directory" />
            {status.downloadDisk && !status.sameDisk && (
              <DiskCard disk={status.downloadDisk} title="Download Dir" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
