"use client";

import { LOCAL_STORAGE_ADMIN_KEY } from "@/lib/guidarr/types";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SKIP_PATHS = ["/setup"];

/** Client bootstrap — redirect to /setup when no adminPassword in localStorage. */
export default function AppBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
      setReady(true);
      return;
    }

    const adminPassword = localStorage.getItem(LOCAL_STORAGE_ADMIN_KEY);
    if (!adminPassword) {
      router.replace("/setup");
      return;
    }

    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
