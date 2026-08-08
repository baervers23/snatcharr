"use client";

import LoginModal from "@/components/guidarr/LoginModal";
import Navbar from "@/components/guidarr/Navbar";
import ProgressBar from "@/components/guidarr/ProgressBar";
import SlideDeck from "@/components/guidarr/SlideDeck";
import type { GuidarrGroup, GuidarrSlideWithHtml } from "@/lib/guidarr/types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface MainViewProps {
  initialGroups: GuidarrGroup[];
  initialConfig: {
    backgroundColor: string;
    backgroundImage: string | null;
  };
}

export default function MainView({ initialGroups, initialConfig }: MainViewProps) {
  const [groups] = useState(initialGroups);
  const [config] = useState(initialConfig);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    initialGroups[0]?.id ?? null,
  );
  const [slides, setSlides] = useState<GuidarrSlideWithHtml[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/guidarr/auth");
      const data = (await res.json()) as { authenticated: boolean };
      setIsAdmin(data.authenticated);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const loadSlides = useCallback(async (groupId: string) => {
    setLoadingSlides(true);
    try {
      const res = await fetch(`/api/guidarr/groups/${groupId}/slides?html=1`);
      if (!res.ok) throw new Error("Failed to load slides");
      const data = (await res.json()) as { slides: GuidarrSlideWithHtml[] };
      setSlides(data.slides);
      setActiveSlideIndex(0);
    } catch {
      toast.error("Could not load slides");
      setSlides([]);
    } finally {
      setLoadingSlides(false);
    }
  }, []);

  useEffect(() => {
    if (activeGroupId) loadSlides(activeGroupId);
  }, [activeGroupId, loadSlides]);

  function handleGroupSelect(groupId: string) {
    setActiveGroupId(groupId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleProgressJump(index: number) {
    const fn = (window as Window & { guidarrScrollToSlide?: (i: number) => void })
      .guidarrScrollToSlide;
    fn?.(index);
    setActiveSlideIndex(index);
  }

  async function handleLogout() {
    await fetch("/api/guidarr/auth", { method: "DELETE" });
    setIsAdmin(false);
    toast.success("Logged out");
  }

  const backgroundStyle = {
    backgroundColor: config.backgroundColor,
    backgroundImage: config.backgroundImage ? `url(${config.backgroundImage})` : undefined,
    backgroundSize: "cover" as const,
    backgroundPosition: "center" as const,
  };

  return (
    <div className="relative min-h-screen" style={backgroundStyle}>
      <div className="pointer-events-none absolute inset-0 bg-background/40 backdrop-blur-[2px]" />

      <Navbar
        groups={groups}
        activeGroupId={activeGroupId}
        onGroupSelect={handleGroupSelect}
        isAdmin={isAdmin}
        onLoginClick={() => setLoginOpen(true)}
        onLogoutClick={handleLogout}
      />

      <ProgressBar
        total={slides.length}
        activeIndex={activeSlideIndex}
        onJump={handleProgressJump}
        labels={slides.map((s) => s.title)}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-2 pb-12 pt-[7.5rem] sm:px-4 sm:pt-[8.5rem]">
        {loadingSlides ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <SlideDeck slides={slides} onActiveIndexChange={setActiveSlideIndex} />
        )}
      </main>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => setIsAdmin(true)}
      />
    </div>
  );
}
