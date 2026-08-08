"use client";

import { LOCAL_STORAGE_ADMIN_KEY } from "@/lib/guidarr/types";
import SetupForm from "@/components/guidarr/SetupForm";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Setup page — skip if adminPassword already exists in localStorage. */
export default function SetupPageClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(LOCAL_STORAGE_ADMIN_KEY)) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <SetupForm />;
}
