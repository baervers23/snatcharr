"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Search,
  Download,
  BarChart2,
  Settings,
  Users,
  Monitor,
  Shield,
  Menu,
  X,
  LogOut,
  User,
  Bell,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import InfoPopup from "./InfoPopup";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/grabs", label: "Grabs", icon: Download },
  { href: "/stats", label: "Stats", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/system", label: "System", icon: Monitor, adminOnly: true },
];

interface AppShellProps {
  user: { id: string; username: string; role: "admin" | "user" };
  instanceName: string;
  infoPopup: string | null;
  children: React.ReactNode;
}

export default function AppShell({ user, instanceName, infoPopup, children }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);

  useEffect(() => {
    if (infoPopup) {
      const key = `info-popup-dismissed-${btoa(infoPopup.slice(0, 50))}`;
      const dismissed = sessionStorage.getItem(key);
      if (!dismissed) setShowInfoPopup(true);
    }
  }, [infoPopup]);

  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "admin");

  function NavLink({ item }: { item: NavItem }) {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        className={cn("nav-item", active && "active")}
        onClick={() => setSidebarOpen(false)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-56 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200",
          "lg:translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-sidebar-border">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate">{instanceName}</span>
          <button
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-sm"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary uppercase">
                  {user.username.charAt(0)}
                </span>
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                  profileOpen && "rotate-180",
                )}
              />
            </button>

            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                <Link
                  href="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4" />
                  My Profile
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3 px-4 sticky top-0 z-20">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Current page title */}
          <h2 className="text-sm font-medium text-foreground hidden sm:block">
            {NAV_ITEMS.find(
              (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
            )?.label ?? "Snatcharr"}
          </h2>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {infoPopup && (
              <button
                onClick={() => setShowInfoPopup(true)}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="Info"
              >
                <Bell className="h-4 w-4" />
              </button>
            )}

            <Link
              href="/profile"
              className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors"
              title="My Profile"
            >
              <span className="text-xs font-semibold text-primary uppercase">
                {user.username.charAt(0)}
              </span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto animate-fade-in">{children}</main>
      </div>

      {/* Info Popup */}
      {showInfoPopup && infoPopup && (
        <InfoPopup
          text={infoPopup}
          onClose={() => {
            setShowInfoPopup(false);
            const key = `info-popup-dismissed-${btoa(infoPopup.slice(0, 50))}`;
            sessionStorage.setItem(key, "1");
          }}
        />
      )}
    </div>
  );
}
