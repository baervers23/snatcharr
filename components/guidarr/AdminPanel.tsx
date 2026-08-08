"use client";

import MarkdownEditor from "@/components/guidarr/MarkdownEditor";
import type { GuidarrGroup, GuidarrSlide } from "@/lib/guidarr/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface AdminPanelProps {
  initialGroups: GuidarrGroup[];
  initialConfig: {
    backgroundColor: string;
    backgroundImage: string | null;
  };
}

export default function AdminPanel({ initialGroups, initialConfig }: AdminPanelProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [groups, setGroups] = useState(initialGroups);
  const [config, setConfig] = useState(initialConfig);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialGroups[0]?.id ?? null,
  );
  const [slides, setSlides] = useState<GuidarrSlide[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [slideTitle, setSlideTitle] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [dragSlideId, setDragSlideId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const checkAuth = useCallback(async () => {
    const res = await fetch("/api/guidarr/auth");
    const data = (await res.json()) as { authenticated: boolean };
    setAuthenticated(data.authenticated);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const loadSlides = useCallback(async (groupId: string) => {
    const res = await fetch(`/api/guidarr/groups/${groupId}/slides`);
    const data = (await res.json()) as { slides: GuidarrSlide[] };
    setSlides(data.slides);
    if (data.slides[0]) {
      setSelectedSlideId(data.slides[0].id);
    } else {
      setSelectedSlideId(null);
      setMarkdown("");
      setSlideTitle("");
      setRedirectUrl("");
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) loadSlides(selectedGroupId);
  }, [selectedGroupId, loadSlides]);

  useEffect(() => {
    if (!selectedGroupId || !selectedSlideId) return;

    fetch(`/api/guidarr/groups/${selectedGroupId}/slides/${selectedSlideId}`)
      .then((r) => r.json())
      .then((data: { slide: GuidarrSlide & { markdown: string } }) => {
        setMarkdown(data.slide.markdown);
        setSlideTitle(data.slide.title);
        setRedirectUrl(data.slide.redirectUrl ?? "");
      })
      .catch(() => toast.error("Failed to load slide"));
  }, [selectedGroupId, selectedSlideId]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/guidarr/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      toast.error("Invalid password");
      return;
    }
    setAuthenticated(true);
    setPassword("");
    toast.success("Welcome, admin");
  }

  async function uploadFile(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/guidarr/upload", { method: "POST", body: form });
    if (!res.ok) {
      toast.error("Upload failed");
      return null;
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch("/api/guidarr/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      toast.success("Background saved");
    } catch {
      toast.error("Failed to save background");
    } finally {
      setSaving(false);
    }
  }

  async function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const res = await fetch("/api/guidarr/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast.error("Failed to create group");
      return;
    }
    const data = (await res.json()) as { group: GuidarrGroup };
    setGroups((g) => [...g, data.group]);
    setSelectedGroupId(data.group.id);
    setNewGroupName("");
    toast.success("Group created");
  }

  async function removeGroup(id: string) {
    if (!confirm("Delete this group and all slides?")) return;
    const res = await fetch(`/api/guidarr/groups/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete group");
      return;
    }
    const next = groups.filter((g) => g.id !== id);
    setGroups(next);
    setSelectedGroupId(next[0]?.id ?? null);
    toast.success("Group deleted");
  }

  async function updateGroupField(id: string, field: "name" | "icon", value: string | null) {
    const res = await fetch(`/api/guidarr/groups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { group: GuidarrGroup };
    setGroups((gs) => gs.map((g) => (g.id === id ? data.group : g)));
  }

  async function addSlide() {
    if (!selectedGroupId) return;
    const res = await fetch(`/api/guidarr/groups/${selectedGroupId}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Slide" }),
    });
    if (!res.ok) {
      toast.error("Failed to add slide");
      return;
    }
    const data = (await res.json()) as { slide: GuidarrSlide };
    setSlides((s) => [...s, data.slide]);
    setSelectedSlideId(data.slide.id);
    toast.success("Slide added");
  }

  async function removeSlide(id: string) {
    if (!selectedGroupId || !confirm("Delete this slide?")) return;
    const res = await fetch(`/api/guidarr/groups/${selectedGroupId}/slides/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete slide");
      return;
    }
    const next = slides.filter((s) => s.id !== id);
    setSlides(next);
    setSelectedSlideId(next[0]?.id ?? null);
    toast.success("Slide deleted");
  }

  async function saveSlide() {
    if (!selectedGroupId || !selectedSlideId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/guidarr/groups/${selectedGroupId}/slides/${selectedSlideId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: slideTitle,
            markdown,
            redirectUrl: redirectUrl.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { slide: GuidarrSlide };
      setSlides((ss) => ss.map((s) => (s.id === selectedSlideId ? data.slide : s)));
      toast.success("Slide saved");
    } catch {
      toast.error("Failed to save slide");
    } finally {
      setSaving(false);
    }
  }

  async function reorderSlides(orderedIds: string[]) {
    if (!selectedGroupId) return;
    const res = await fetch(`/api/guidarr/groups/${selectedGroupId}/slides`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) {
      toast.error("Reorder failed");
      return;
    }
    const data = (await res.json()) as { slides: GuidarrSlide[] };
    setSlides(data.slides);
  }

  function handleSlideDragEnd(targetId: string) {
    if (!dragSlideId || dragSlideId === targetId) return;
    const ids = slides.map((s) => s.id);
    const from = ids.indexOf(dragSlideId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragSlideId);
    setDragSlideId(null);
    reorderSlides(ids);
  }

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl"
        >
          <h1 className="mb-2 text-2xl font-bold text-foreground">Admin Area</h1>
          <p className="mb-6 text-sm text-muted-foreground">Enter your admin password to continue.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Admin password"
            required
            autoFocus
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md"
          >
            Unlock Admin
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to main page
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 shadow-md backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Main Page
            </Link>
            <h1 className="text-lg font-bold text-foreground">Admin</h1>
          </div>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/guidarr/auth", { method: "DELETE" });
              setAuthenticated(false);
            }}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
        {/* Background settings */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Main Page Background</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Background Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.backgroundColor}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, backgroundColor: e.target.value }))
                  }
                  className="h-10 w-14 cursor-pointer rounded-lg border border-border"
                />
                <input
                  type="text"
                  value={config.backgroundColor}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, backgroundColor: e.target.value }))
                  }
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Background Image</label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground">
                <ImagePlus className="h-4 w-4" />
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadFile(file);
                    if (url) setConfig((c) => ({ ...c, backgroundImage: url }));
                  }}
                />
              </label>
              {config.backgroundImage ? (
                <button
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, backgroundImage: null }))}
                  className="text-xs text-destructive"
                >
                  Remove image
                </button>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={saveConfig}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md"
          >
            <Save className="h-4 w-4" />
            Save Background
          </button>
        </section>

        {/* Groups */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Groups</h2>
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="New group name"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addGroup}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className={cn(
                  "rounded-xl border p-4 transition",
                  selectedGroupId === group.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background",
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId(group.id)}
                    className="font-medium text-foreground"
                  >
                    {group.name}
                  </button>
                  <input
                    type="text"
                    defaultValue={group.name}
                    onBlur={(e) => updateGroupField(group.id, "name", e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-background px-2 py-1 text-sm min-w-[120px]"
                  />
                  <label className="cursor-pointer rounded-lg border border-border p-2 hover:bg-accent">
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadFile(file);
                        if (url) updateGroupField(group.id, "icon", url);
                      }}
                    />
                  </label>
                  {group.icon ? (
                    <Image src={group.icon} alt="" width={32} height={32} className="h-8 w-8 rounded" unoptimized />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeGroup(group.id)}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Slides for selected group */}
        {selectedGroupId ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Slides</h2>
              <button
                type="button"
                onClick={addSlide}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Plus className="h-4 w-4" /> Add Slide
              </button>
            </div>

            <ul className="mb-6 space-y-2">
              {slides.map((slide) => (
                <li
                  key={slide.id}
                  draggable
                  onDragStart={() => setDragSlideId(slide.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleSlideDragEnd(slide.id)}
                  className={cn(
                    "flex cursor-grab items-center gap-2 rounded-lg border px-3 py-2 transition active:cursor-grabbing",
                    selectedSlideId === slide.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50",
                  )}
                  onClick={() => setSelectedSlideId(slide.id)}
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{slide.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSlide(slide.id);
                    }}
                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            {selectedSlideId ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={slideTitle}
                  onChange={(e) => setSlideTitle(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium"
                  placeholder="Slide title"
                />

                <MarkdownEditor value={markdown} onChange={setMarkdown} />

                <div className="rounded-xl border border-border bg-background p-4">
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <ExternalLink className="h-4 w-4" />
                    Redirect URL (when slide becomes active)
                  </label>
                  <input
                    type="url"
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={saveSlide}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Slide
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
