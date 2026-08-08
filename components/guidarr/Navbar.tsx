"use client";

import { cn } from "@/lib/utils";
import type { GuidarrGroup } from "@/lib/guidarr/types";
import { BookOpen, LogIn, LogOut, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface NavbarProps {
  groups: GuidarrGroup[];
  activeGroupId: string | null;
  onGroupSelect: (groupId: string) => void;
  isAdmin: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

export default function Navbar({
  groups,
  activeGroupId,
  onGroupSelect,
  isAdmin,
  onLoginClick,
  onLogoutClick,
}: NavbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-card/90 shadow-lg backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-foreground">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Guidarr</span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onGroupSelect(group.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                activeGroupId === group.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {group.icon ? (
                <Image
                  src={group.icon}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded object-cover"
                  unoptimized
                />
              ) : null}
              {group.name}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {isAdmin ? (
            <>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition hover:bg-accent"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
              <button
                type="button"
                onClick={onLogoutClick}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLoginClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-md transition hover:opacity-90"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
