"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings, Shield, Search, Download, Layers, Save, Loader2, Plus, Trash2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { cn, maskApiKey } from "@/lib/utils";
import type { AppSettings } from "@/lib/db/settings";
import type { Indexer, DownloadClient, ExternalApp } from "@/lib/db/schema";

type SettingsTab = "general" | "security" | "indexers" | "clients" | "apps";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "general", label: "General", icon: Settings },
  { id: "security", label: "Security", icon: Shield },
  { id: "indexers", label: "Indexers", icon: Search },
  { id: "clients", label: "Download Clients", icon: Download },
  { id: "apps", label: "Apps", icon: Layers },
];

interface Props {
  settings: Partial<AppSettings>;
  indexers: Indexer[];
  downloadClients: DownloadClient[];
  externalApps: ExternalApp[];
}

export default function SettingsView({ settings: initialSettings, indexers: initialIndexers, downloadClients: initialClients, externalApps: initialApps }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [settings, setSettings] = useState(initialSettings);
  const [indexers, setIndexers] = useState(initialIndexers);
  const [clients, setClients] = useState(initialClients);
  const [apps, setApps] = useState(initialApps);
  const [saving, setSaving] = useState(false);

  async function saveSettings(partial: Partial<AppSettings>) {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!response.ok) throw new Error();
      setSettings((prev) => ({ ...prev, ...partial }));
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        Settings
      </h1>

      <div className="flex gap-6">
        {/* Tab sidebar */}
        <nav className="w-48 shrink-0 space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {activeTab === "general" && (
            <GeneralTab settings={settings} onSave={saveSettings} saving={saving} />
          )}
          {activeTab === "security" && (
            <SecurityTab settings={settings} onSave={saveSettings} saving={saving} />
          )}
          {activeTab === "indexers" && (
            <IndexersTab indexers={indexers} onRefresh={async () => {
              const r = await fetch("/api/indexers");
              const d = await r.json() as { indexers: Indexer[] };
              setIndexers(d.indexers ?? []);
            }} />
          )}
          {activeTab === "clients" && (
            <ClientsTab clients={clients} onRefresh={async () => {
              const r = await fetch("/api/download-clients");
              const d = await r.json() as { clients: DownloadClient[] };
              setClients(d.clients ?? []);
            }} />
          )}
          {activeTab === "apps" && (
            <AppsTab apps={apps} onRefresh={async () => {
              const r = await fetch("/api/apps");
              const d = await r.json() as { apps: ExternalApp[] };
              setApps(d.apps ?? []);
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab({ settings, onSave, saving }: { settings: Partial<AppSettings>; onSave: (s: Partial<AppSettings>) => void; saving: boolean }) {
  const [form, setForm] = useState({
    instanceName: settings.instanceName ?? "Snatcharr",
    maxResults: settings.maxResults ?? 100,
    maxGrabsPerUserPerDay: settings.maxGrabsPerUserPerDay ?? 20,
    downloadAvailabilityHours: settings.downloadAvailabilityHours ?? 72,
    autoDeleteAfterDays: settings.autoDeleteAfterDays ?? 7,
    logLevel: settings.logLevel ?? "info",
    infoPopupEnabled: settings.infoPopupEnabled ?? false,
    infoPopupText: settings.infoPopupText ?? "",
  });

  return (
    <div className="nv-card p-5 space-y-5">
      <h2 className="text-base font-semibold">General Settings</h2>

      <FieldRow label="Instance Name" description="Shown in the browser title and sidebar">
        <input className="nv-input w-full" value={form.instanceName} onChange={(e) => setForm({ ...form, instanceName: e.target.value })} />
      </FieldRow>

      <FieldRow label="Max Search Results" description="Maximum results returned per search">
        <input className="nv-input w-32" type="number" min={10} max={500} value={form.maxResults} onChange={(e) => setForm({ ...form, maxResults: parseInt(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Max Grabs / User / Day" description="0 = unlimited">
        <input className="nv-input w-32" type="number" min={0} value={form.maxGrabsPerUserPerDay} onChange={(e) => setForm({ ...form, maxGrabsPerUserPerDay: parseInt(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Download Availability (hours)" description="How long download links stay active after completion">
        <input className="nv-input w-32" type="number" min={1} value={form.downloadAvailabilityHours} onChange={(e) => setForm({ ...form, downloadAvailabilityHours: parseInt(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Auto-Delete After (days)" description="Automatically remove completed downloads after N days (0 = disabled)">
        <input className="nv-input w-32" type="number" min={0} value={form.autoDeleteAfterDays} onChange={(e) => setForm({ ...form, autoDeleteAfterDays: parseInt(e.target.value) })} />
      </FieldRow>

      <FieldRow label="Log Level">
        <select className="nv-input w-32" value={form.logLevel} onChange={(e) => setForm({ ...form, logLevel: e.target.value as AppSettings["logLevel"] })}>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>
      </FieldRow>

      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-semibold">Info Popup</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={form.infoPopupEnabled}
              onChange={(e) => setForm({ ...form, infoPopupEnabled: e.target.checked })}
            />
            <span className="text-sm">Show popup to users on login</span>
          </label>
        </div>
        {form.infoPopupEnabled && (
          <textarea
            className="nv-input w-full min-h-24 resize-y"
            placeholder="Enter the message to show to users..."
            value={form.infoPopupText}
            onChange={(e) => setForm({ ...form, infoPopupText: e.target.value })}
          />
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab({ settings, onSave, saving }: { settings: Partial<AppSettings>; onSave: (s: Partial<AppSettings>) => void; saving: boolean }) {
  const [form, setForm] = useState({
    authMethod: settings.authMethod ?? "local",
    sessionTimeoutHours: settings.sessionTimeoutHours ?? 24,
  });

  return (
    <div className="nv-card p-5 space-y-5">
      <h2 className="text-base font-semibold">Security Settings</h2>

      <FieldRow label="Authentication Method">
        <select
          className="nv-input w-48"
          value={form.authMethod}
          onChange={(e) => setForm({ ...form, authMethod: e.target.value as AppSettings["authMethod"] })}
        >
          <option value="local">Local (Username/Password)</option>
          <option value="jellyfin">Jellyfin</option>
          <option value="organizr">Organizr v2</option>
        </select>
      </FieldRow>

      <FieldRow label="Session Timeout (hours)">
        <input
          className="nv-input w-32"
          type="number"
          min={1}
          max={720}
          value={form.sessionTimeoutHours}
          onChange={(e) => setForm({ ...form, sessionTimeoutHours: parseInt(e.target.value) })}
        />
      </FieldRow>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Indexers Tab ─────────────────────────────────────────────────────────────

function IndexersTab({ indexers, onRefresh }: { indexers: Indexer[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", prowlarrUrl: "http://localhost:9696", apiKey: "", categories: "" });
  const [saving, setSaving] = useState(false);

  async function addIndexer() {
    setSaving(true);
    try {
      const response = await fetch("/api/indexers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error();
      toast.success("Indexer added");
      setShowAdd(false);
      setForm({ name: "", prowlarrUrl: "http://localhost:9696", apiKey: "", categories: "" });
      onRefresh();
    } catch {
      toast.error("Failed to add indexer");
    } finally {
      setSaving(false);
    }
  }

  async function testIndexer(id: string) {
    setTesting(id);
    try {
      const response = await fetch(`/api/indexers/${id}/test`, { method: "POST" });
      const data = await response.json() as { ok: boolean; version?: string; error?: string };
      if (data.ok) toast.success(`Connection OK${data.version ? ` (v${data.version})` : ""}`);
      else toast.error(`Connection failed: ${data.error ?? "Unknown error"}`);
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(null);
    }
  }

  async function deleteIndexer(id: string) {
    if (!confirm("Delete this indexer?")) return;
    try {
      await fetch(`/api/indexers?id=${id}`, { method: "DELETE" });
      toast.success("Indexer removed");
      onRefresh();
    } catch {
      toast.error("Failed to delete indexer");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Indexers (Prowlarr)</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Indexer
        </button>
      </div>

      {showAdd && (
        <div className="nv-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Prowlarr Indexer</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input className="nv-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Prowlarr" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prowlarr URL</label>
              <input className="nv-input w-full" value={form.prowlarrUrl} onChange={(e) => setForm({ ...form, prowlarrUrl: e.target.value })} placeholder="http://localhost:9696" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
              <input className="nv-input w-full font-mono" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="API key" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categories (comma-separated IDs)</label>
              <input className="nv-input w-full" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} placeholder="e.g. 2000,5000,4000" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={addIndexer} disabled={saving || !form.prowlarrUrl || !form.apiKey} className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </div>
        </div>
      )}

      {indexers.length === 0 ? (
        <div className="nv-card p-8 text-center text-muted-foreground text-sm">No indexers configured.</div>
      ) : (
        <div className="nv-card divide-y divide-border overflow-hidden">
          {indexers.map((idx) => (
            <div key={idx.id} className="flex items-center gap-3 p-4">
              <StatusDot status={idx.lastStatus ?? "unknown"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{idx.name}</p>
                <p className="text-xs text-muted-foreground truncate">{idx.prowlarrUrl}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testIndexer(idx.id)}
                  disabled={testing === idx.id}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {testing === idx.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                </button>
                <button onClick={() => deleteIndexer(idx.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────

function ClientsTab({ clients, onRefresh }: { clients: DownloadClient[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "SABnzbd", type: "sabnzbd" as const, url: "http://localhost:8080", apiKey: "", category: "snatcharr" });
  const [saving, setSaving] = useState(false);

  async function addClient() {
    setSaving(true);
    try {
      const response = await fetch("/api/download-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error();
      toast.success("Download client added");
      setShowAdd(false);
      onRefresh();
    } catch {
      toast.error("Failed to add client");
    } finally {
      setSaving(false);
    }
  }

  async function testClient(id: string) {
    setTesting(id);
    try {
      const response = await fetch(`/api/download-clients/${id}/test`, { method: "POST" });
      const data = await response.json() as { ok: boolean; version?: string; error?: string };
      if (data.ok) toast.success(`Connection OK${data.version ? ` (v${data.version})` : ""}`);
      else toast.error(`Connection failed: ${data.error ?? "Unknown error"}`);
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(null);
    }
  }

  async function deleteClient(id: string) {
    if (!confirm("Delete this client?")) return;
    try {
      await fetch(`/api/download-clients?id=${id}`, { method: "DELETE" });
      toast.success("Client removed");
      onRefresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Download Clients</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      {showAdd && (
        <div className="nv-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Download Client</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <select className="nv-input w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                <option value="sabnzbd">SABnzbd</option>
                <option value="nzbget">NZBGet</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input className="nv-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL</label>
              <input className="nv-input w-full" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
              <input className="nv-input w-full font-mono" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <input className="nv-input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="snatcharr" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={addClient} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </div>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="nv-card p-8 text-center text-muted-foreground text-sm">No download clients configured.</div>
      ) : (
        <div className="nv-card divide-y divide-border overflow-hidden">
          {clients.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-4">
              <StatusDot status={c.lastStatus ?? "unknown"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{c.name} <span className="text-xs text-muted-foreground">({c.type})</span></p>
                <p className="text-xs text-muted-foreground truncate">{c.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => testClient(c.id)} disabled={testing === c.id} className="px-3 py-1 text-xs border border-border rounded hover:bg-accent transition-colors disabled:opacity-50">
                  {testing === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                </button>
                <button onClick={() => deleteClient(c.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Apps Tab ─────────────────────────────────────────────────────────────────

function AppsTab({ apps, onRefresh }: { apps: ExternalApp[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "jellyfin" as const, url: "", apiKey: "" });
  const [saving, setSaving] = useState(false);

  async function addApp() {
    setSaving(true);
    try {
      const response = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error();
      toast.success("App added");
      setShowAdd(false);
      onRefresh();
    } catch {
      toast.error("Failed to add app");
    } finally {
      setSaving(false);
    }
  }

  async function deleteApp(id: string) {
    if (!confirm("Remove this app?")) return;
    try {
      await fetch(`/api/apps?id=${id}`, { method: "DELETE" });
      toast.success("App removed");
      onRefresh();
    } catch {
      toast.error("Failed to remove");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">External Apps</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add App
        </button>
      </div>

      {showAdd && (
        <div className="nv-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <select className="nv-input w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
                <option value="jellyfin">Jellyfin</option>
                <option value="jellyseerr">Jellyseerr</option>
                <option value="sonarr">Sonarr</option>
                <option value="radarr">Radarr</option>
                <option value="lidarr">Lidarr</option>
                <option value="organizr">Organizr</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input className="nv-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL</label>
              <input className="nv-input w-full" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
              <input className="nv-input w-full font-mono" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={addApp} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </div>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="nv-card p-8 text-center text-muted-foreground text-sm">No external apps configured.</div>
      ) : (
        <div className="nv-card divide-y divide-border overflow-hidden">
          {apps.map((app) => (
            <div key={app.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{app.name} <span className="text-xs text-muted-foreground">({app.type})</span></p>
                <p className="text-xs text-muted-foreground truncate">{app.url}</p>
              </div>
              <button onClick={() => deleteApp(app.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full shrink-0",
        status === "ok" && "bg-green-400",
        status === "warning" && "bg-yellow-400",
        status === "error" && "bg-red-400",
        status === "unknown" && "bg-muted-foreground",
      )}
    />
  );
}

function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
