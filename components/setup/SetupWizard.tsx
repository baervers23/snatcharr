"use client";

import {
  ADDITIONAL_APP_LOGIN_NOTE,
  ADDITIONAL_APP_TYPES,
  type AdditionalAppType,
} from "@/lib/additional-app-types";
import { defaultServiceUrl } from "@/lib/service-urls";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronRight,
  Download,
  Info,
  Layers,
  Loader2,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import { authMethodOptions } from "@/lib/auth-methods";
import type { SetupPrefillData } from "@/lib/setup-prefill";
import type { SetupGeneralSettings } from "@/lib/setup-settings";
import type { SetupPageStatus } from "@/lib/setup-status";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";


type Step = 1 | 2 | 3 | 4 | 5;

interface AdminData {
  username: string;
  password: string;
  confirmPassword: string;
}

interface IndexerItem {
  id: string;
  name: string;
  type: "prowlarr" | "nzbhydra2" | "jackett";
  url: string;
  apiKey: string;
  categories: string;
  tested: boolean;
}

interface ClientItem {
  id: string;
  name: string;
  type: "sabnzbd" | "nzbget" | "qbittorrent" | "transmission" | "deluge";
  url: string;
  apiKey: string;
  category: string;
  tested: boolean;
}

interface AppItem {
  id: string;
  name: string;
  type: AdditionalAppType;
  url: string;
  apiKey: string;
  tested: boolean;
}

type GeneralSettingsData = SetupGeneralSettings;


const STEPS = [
  { id: 1, label: "Local Admin", icon: User },
  { id: 2, label: "Indexer Client", icon: Search },
  { id: 3, label: "Download Client", icon: Download },
  { id: 4, label: "Additional Apps", icon: Layers },
  { id: 5, label: "General Settings", icon: Settings },
] as const;

const CLIENT_TYPE_GROUPS: Array<{
  group: string;
  options: Array<{ value: ClientItem["type"]; label: string }>;
}> = [
  {
    group: "Usenet",
    options: [
      { value: "sabnzbd", label: "SABnzbd" },
      { value: "nzbget", label: "NZBGet" },
    ],
  },
  {
    group: "Torrent",
    options: [
      { value: "qbittorrent", label: "qBittorrent" },
      { value: "transmission", label: "Transmission" },
      { value: "deluge", label: "Deluge" },
    ],
  },
];

const INDEXER_TYPES: Array<{
  value: IndexerItem["type"];
  label: string;
  defaultUrl: string;
  defaultName: string;
}> = [
  {
    value: "prowlarr",
    label: "Prowlarr",
    defaultUrl: defaultServiceUrl("prowlarr"),
    defaultName: "Prowlarr",
  },
  {
    value: "nzbhydra2",
    label: "NZBHydra2",
    defaultUrl: defaultServiceUrl("nzbhydra2"),
    defaultName: "NZBHydra2",
  },
  {
    value: "jackett",
    label: "Jackett",
    defaultUrl: defaultServiceUrl("jackett"),
    defaultName: "Jackett",
  },
];

const SETUP_APP_OPTIONS = Object.entries(ADDITIONAL_APP_TYPES).map(([value, meta]) => ({
  value: value as AdditionalAppType,
  label: meta.label,
}));

const API_KEY_HELP: Record<string, string> = {
  prowlarr: "Find it in Prowlarr → Settings → General → Security → API Key",
  nzbhydra2:
    "Find it in NZBHydra2 → Config → Main → API Key  (or leave empty if auth is disabled)",
  jackett:
    "Find it in Jackett → Dashboard top-right → API Key  (copy the long hex string)",
  sabnzbd: "Find it in SABnzbd → Config → General → API Key",
  nzbget: "NZBGet uses username/password auth. Enter your ControlPassword here.",
  qbittorrent:
    "Set a Web UI password in qBittorrent → Tools → Options → Web UI → Authentication",
  transmission:
    "Find it in Transmission's settings.json → rpc-password (or configure via preferences)",
  deluge: "Find it in Deluge → Preferences → Daemon → Authentication → Password",
  jellyfin: "Find it in Jellyfin → Dashboard → API Keys → ✚ Add API Key",
  seerr:
    "Find it in Seerr → Settings → General → API Key",
  organizr: "Find it in Organizr → Settings → API → Main API Key",
  jfago: "Optional — only if your JFA-GO instance requires API authentication",
};


const blankIndexer = (type: IndexerItem["type"] = "prowlarr"): IndexerItem => {
  const preset = INDEXER_TYPES.find((t) => t.value === type)!;
  return {
    id: crypto.randomUUID(),
    name: preset.defaultName,
    type,
    url: preset.defaultUrl,
    apiKey: "",
    categories: "",
    tested: false,
  };
};

const blankClient = (type: ClientItem["type"] = "sabnzbd"): ClientItem => ({
  id: crypto.randomUUID(),
  name: type === "nzbget" ? "NZBGet" : "SABnzbd",
  type,
  url: defaultServiceUrl(type),
  apiKey: "",
  category: "snatcharr",
  tested: false,
});

const blankApp = (type: AppItem["type"] = "jellyfin"): AppItem => ({
  id: crypto.randomUUID(),
  name: SETUP_APP_OPTIONS.find((t) => t.value === type)?.label ?? type,
  type,
  url: defaultServiceUrl(type),
  apiKey: "",
  tested: false,
});


export default function SetupWizard({
  prefill,
  setupStatus: initialSetupStatus,
}: {
  prefill?: SetupPrefillData;
  setupStatus: SetupPageStatus;
}) {
  const router = useRouter();
  const prefillNotified = useRef(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [setupStatus, setSetupStatus] = useState(initialSetupStatus);

  const [adminData, setAdminData] = useState<AdminData>({
    username: prefill?.adminUsername ?? "",
    password: "",
    confirmPassword: "",
  });

  const [addedIndexers, setAddedIndexers] = useState<IndexerItem[]>(
    (prefill?.indexers ?? []) as IndexerItem[],
  );
  const [pendingIndexer, setPendingIndexer] = useState<IndexerItem>(blankIndexer);
  const [testingIndexer, setTestingIndexer] = useState(false);
  const [indexerTestStatus, setIndexerTestStatus] = useState<"success" | "error" | null>(null);

  const [addedClients, setAddedClients] = useState<ClientItem[]>(
    (prefill?.clients ?? []) as ClientItem[],
  );
  const [pendingClient, setPendingClient] = useState<ClientItem>(blankClient);
  const [testingClient, setTestingClient] = useState(false);
  const [clientTestStatus, setClientTestStatus] = useState<"success" | "error" | null>(null);

  const [addedApps, setAddedApps] = useState<AppItem[]>(
    (prefill?.apps ?? []) as AppItem[],
  );
  const [pendingApp, setPendingApp] = useState<AppItem>(blankApp);
  const [testingApp, setTestingApp] = useState(false);
  const [appTestStatus, setAppTestStatus] = useState<"success" | "error" | null>(null);

  const [generalSettings, setGeneralSettings] = useState<GeneralSettingsData>({
    authMethod: prefill?.generalSettings?.authMethod ?? "local",
    signupEnabled: prefill?.generalSettings?.signupEnabled ?? false,
    requireEmail: prefill?.generalSettings?.requireEmail ?? false,
    requireAppGrant: prefill?.generalSettings?.requireAppGrant ?? false,
    maxSearchRequestsPerUserPerDay: prefill?.generalSettings?.maxSearchRequestsPerUserPerDay ?? 0,
    maxGrabsPerUserPerDay: prefill?.generalSettings?.maxGrabsPerUserPerDay ?? 0,
    warningOnOpen: prefill?.generalSettings?.warningOnOpen ?? "once",
    importantPopupText: prefill?.generalSettings?.importantPopupText ?? "",
  });
  const [configLoaded] = useState(!!prefill?.hasExistingData);

  const { hasJellyfin, hasOrganizr, hasSeerr } = authMethodOptions(addedApps);

  function applyPrefill(data: SetupPrefillData) {
    setAdminData((prev) => ({
      ...prev,
      username: data.adminUsername || prev.username,
      password: "",
      confirmPassword: "",
    }));
    setAddedIndexers((data.indexers ?? []) as IndexerItem[]);
    setAddedClients((data.clients ?? []) as ClientItem[]);
    setAddedApps((data.apps ?? []) as AppItem[]);
    if (data.generalSettings) {
      setGeneralSettings(data.generalSettings);
    }
  }

  async function loadConfigJson() {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/setup");
      if (!res.ok) throw new Error("Failed to load config");
      const data = (await res.json()) as SetupPrefillData & {
        status?: SetupPageStatus;
      };
      applyPrefill(data);
      if (data.status) setSetupStatus(data.status);
      toast.success("config.json loaded — fields pre-filled. Re-enter the admin password.");
    } catch {
      toast.error("Could not load config.json");
    } finally {
      setLoadingConfig(false);
    }
  }

  useEffect(() => {
    if (!configLoaded || prefillNotified.current) return;
    prefillNotified.current = true;
    toast.message("config.json loaded — fields pre-filled. Re-enter the admin password on step 1.");
  }, [configLoaded]);

  async function persistProgress() {
    try {
      await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveProgress",
          indexers: addedIndexers,
          clients: addedClients,
          apps: addedApps,
          generalSettings,
        }),
      });
    } catch {
      // best-effort
    }
  }

  async function goToStep(step: Step) {
    await persistProgress();
    setCurrentStep(step);
  }

  const [apiInfoModal, setApiInfoModal] = useState<string | null>(null);


  async function testIndexer() {
    if (!pendingIndexer.url || !pendingIndexer.apiKey) {
      toast.error("Please enter URL and API Key");
      return;
    }
    if (!pendingIndexer.url.startsWith("http")) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    setTestingIndexer(true);
    setIndexerTestStatus(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          type: "prowlarr",
          url: pendingIndexer.url,
          apiKey: pendingIndexer.apiKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIndexerTestStatus("success");
        setPendingIndexer((prev) => ({ ...prev, tested: true }));
        toast.success("Indexer connected successfully");
      } else {
        setIndexerTestStatus("error");
        toast.error(data.error ?? "Connection failed");
      }
    } catch {
      setIndexerTestStatus("error");
      toast.error("Connection failed");
    } finally {
      setTestingIndexer(false);
      setTimeout(() => setIndexerTestStatus(null), 3000);
    }
  }

  async function testClient() {
    if (!pendingClient.url || !pendingClient.apiKey) {
      toast.error("Please enter URL and API Key");
      return;
    }
    if (!pendingClient.url.startsWith("http")) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    setTestingClient(true);
    setClientTestStatus(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          type: pendingClient.type,
          url: pendingClient.url,
          apiKey: pendingClient.apiKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setClientTestStatus("success");
        setPendingClient((prev) => ({ ...prev, tested: true }));
        toast.success("Download client connected successfully");
      } else {
        setClientTestStatus("error");
        toast.error(data.error ?? "Connection failed");
      }
    } catch {
      setClientTestStatus("error");
      toast.error("Connection failed");
    } finally {
      setTestingClient(false);
      setTimeout(() => setClientTestStatus(null), 3000);
    }
  }

  async function testApp() {
    if (!pendingApp.url) {
      toast.error("Please enter a URL");
      return;
    }
    if (!pendingApp.url.startsWith("http")) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    setTestingApp(true);
    setAppTestStatus(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          type: pendingApp.type,
          url: pendingApp.url,
          apiKey: pendingApp.apiKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAppTestStatus("success");
        setPendingApp((prev) => ({ ...prev, tested: true }));
        toast.success("App connected successfully");
      } else {
        setAppTestStatus("error");
        toast.error(data.error ?? "Connection failed");
      }
    } catch {
      setAppTestStatus("error");
      toast.error("Connection failed");
    } finally {
      setTestingApp(false);
      setTimeout(() => setAppTestStatus(null), 3000);
    }
  }


  function addIndexer() {
    if (!pendingIndexer.url || !pendingIndexer.apiKey) {
      toast.error("Please fill in URL and API Key first");
      return;
    }
    setAddedIndexers((prev) => [...prev, { ...pendingIndexer }]);
    setPendingIndexer(blankIndexer());
    setIndexerTestStatus(null);
    toast.success(`"${pendingIndexer.name}" added`);
  }

  function addClient() {
    if (!pendingClient.url || !pendingClient.apiKey) {
      toast.error("Please fill in URL and API Key first");
      return;
    }
    setAddedClients((prev) => [...prev, { ...pendingClient }]);
    setPendingClient(blankClient());
    setClientTestStatus(null);
    toast.success(`"${pendingClient.name}" added`);
  }

  function addApp() {
    if (!pendingApp.url) {
      toast.error("Please fill in the URL first");
      return;
    }
    setAddedApps((prev) => [...prev, { ...pendingApp }]);
    setPendingApp(blankApp());
    toast.success(
      `"${pendingApp.name || SETUP_APP_OPTIONS.find((t) => t.value === pendingApp.type)?.label}" added`,
    );
  }


  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (adminData.password !== adminData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (adminData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveAdmin", admin: adminData }),
      });
      const data = (await response.json()) as { error?: string; finished?: boolean };
      if (!response.ok) {
        toast.error(data.error ?? "Failed to save admin account");
        return;
      }
      if (data.finished) {
        toast.success("Admin account created — redirecting to login…");
        router.push("/login");
        return;
      }
      const statusRes = await fetch("/api/setup");
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as { status?: SetupPageStatus };
        if (statusData.status) setSetupStatus(statusData.status);
      }
      setCurrentStep(2);
    } catch {
      toast.error("Failed to save admin account");
    } finally {
      setLoading(false);
    }
  }


  async function handleFinish() {
    setLoading(true);
    try {
      await persistProgress();
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          admin: adminData,
          indexers: addedIndexers,
          clients: addedClients,
          apps: addedApps,
          generalSettings,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Setup failed");
        return;
      }
      toast.success("Setup complete! Redirecting...");
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      toast.error("Setup failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }


  const badges = [
    ...addedIndexers.map((ix) => ({
      id: ix.id,
      label: ix.name,
      step: 2,
      onRemove: () => setAddedIndexers((prev) => prev.filter((x) => x.id !== ix.id)),
    })),
    ...addedClients.map((cl) => ({
      id: cl.id,
      label: cl.name,
      step: 3,
      onRemove: () => setAddedClients((prev) => prev.filter((x) => x.id !== cl.id)),
    })),
    ...addedApps.map((ap) => ({
      id: ap.id,
      label: ap.name || SETUP_APP_OPTIONS.find((t) => t.value === ap.type)?.label || ap.type,
      step: 4,
      onRemove: () => setAddedApps((prev) => prev.filter((x) => x.id !== ap.id)),
    })),
  ];


  return (
    <div className="min-h-screen bg-background flex flex-col">

      <header className="w-full pt-6 pb-4 px-6 flex items-center gap-4 border-b border-border/50">
        <LogoImage size={64} />
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Snatcharr</h1>
          <p className="text-xs text-muted-foreground">Initial Setup Wizard</p>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pt-10 pb-8">
      <div className="w-full max-w-2xl">

      <div className="flex items-start justify-between mb-4 px-0.5">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const state =
            step.id < currentStep
              ? "completed"
              : step.id === currentStep
              ? "current"
              : "pending";
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                    state === "completed" && "bg-green-500 border-green-500",
                    state === "current" && "border-primary bg-primary/10",
                    state === "pending" && "border-border bg-card",
                  )}
                >
                  {state === "completed" ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : (
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        state === "current" ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] mt-1 font-medium text-center leading-tight w-14",
                    state === "current" ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 sm:w-12 mx-1 -mt-5 shrink-0 transition-colors",
                    step.id < currentStep ? "bg-green-500" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {configLoaded && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium text-primary">Configuration loaded from config.json</p>
          <p className="text-xs text-muted-foreground mt-1">
            {addedIndexers.length} indexer(s), {addedClients.length} download client(s), {addedApps.length} app(s) pre-filled.
            {adminData.username ? ` Admin: ${adminData.username}.` : ""} Password must be re-entered on step 1.
          </p>
        </div>
      )}

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4 px-0.5">
          {badges.map((b) => (
            <span
              key={b.id}
              className="inline-flex items-center gap-1 text-xs bg-green-500/10 border border-green-500/30 text-green-400 pl-2 pr-1 py-0.5 rounded-full font-medium"
            >
              <Check className="h-3 w-3 shrink-0" />
              {b.label}
              <button
                type="button"
                onClick={b.onRemove}
                className="ml-0.5 rounded-full hover:bg-green-500/20 p-0.5 transition-colors"
                aria-label={`Remove ${b.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Step card */}
      <div className="nv-card p-6 sm:p-8">

        {currentStep === 1 && (
          <form onSubmit={handleAdminSubmit} className="space-y-6">
            <StepHeader
              title="Create Local Admin Account"
              description="This will be the primary local administrator account for Snatcharr."
            />

            {(setupStatus.configExists || setupStatus.needsPrimaryLocalAdmin) && (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm space-y-1">
                {setupStatus.configExists && (
                  <p className="text-foreground">
                    <span className="font-medium">config.json</span> found at{" "}
                    <code className="text-xs bg-muted px-1 rounded">{setupStatus.configPath}</code>
                    {setupStatus.configSetupComplete ? (
                      <span className="text-green-400"> — setupComplete: true</span>
                    ) : (
                      <span className="text-muted-foreground"> — setup not marked complete</span>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Database: <code className="bg-muted px-1 rounded">{setupStatus.dbPath}</code>
                </p>
                {setupStatus.needsPrimaryLocalAdmin && (
                  <p className="text-amber-400">
                    <span className="font-medium">Need to create a primary local admin</span>
                    {" — "}
                    {setupStatus.configSetupComplete
                      ? "no admin with password found in the database at the path above. Enter a password and click “Create admin & go to login”."
                      : "no admin account found in the database."}
                  </p>
                )}
                {setupStatus.adminNeedsPassword && (
                  <p className="text-amber-400">
                    Admin user exists but has no password — set one below to finish setup.
                  </p>
                )}
                {setupStatus.hasPrimaryLocalAdmin && (
                  <p className="text-green-400">Primary local admin exists in the database.</p>
                )}
              </div>
            )}

            <div className="nv-card p-5 space-y-4 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">Username *</label>
                <input
                  className="nv-input w-full"
                  type="text"
                  placeholder="admin"
                  value={adminData.username}
                  onChange={(e) => setAdminData({ ...adminData, username: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="nv-label">Password *</label>
                <input
                  className="nv-input w-full"
                  type="password"
                  placeholder="At least 8 characters"
                  value={adminData.password}
                  onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="nv-label">Confirm Password *</label>
                <input
                  className="nv-input w-full"
                  type="password"
                  placeholder="Repeat password"
                  value={adminData.confirmPassword}
                  onChange={(e) =>
                    setAdminData({ ...adminData, confirmPassword: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <StepFooter
              isFirst
              loading={loading}
              nextLabel={
                setupStatus.configSetupComplete ? "Create admin & go to login" : "Continue"
              }
              leftAction={
                <button
                  type="button"
                  disabled={!setupStatus.configExists || loadingConfig}
                  onClick={() => void loadConfigJson()}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={
                    setupStatus.configExists
                      ? "Load settings from config.json"
                      : "config.json not found on the server"
                  }
                >
                  {loadingConfig ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading…
                    </span>
                  ) : (
                    "Load config.json"
                  )}
                </button>
              }
            />
          </form>
        )}

        {currentStep === 2 && (
          <div className="space-y-5">
            <StepHeader
              title="Indexer Client"
              description="Connect to your Indexer Client to enable searching."
            />

            {/* Input box */}
            <div className="nv-card p-5 space-y-4 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">Type</label>
                <select
                  className="nv-input w-full"
                  value={pendingIndexer.type}
                  onChange={(e) => {
                    const t = e.target.value as IndexerItem["type"];
                    setPendingIndexer(blankIndexer(t));
                    setIndexerTestStatus(null);
                  }}
                >
                  {INDEXER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="nv-label">Display Name</label>
                <input
                  className="nv-input w-full"
                  value={pendingIndexer.name}
                  onChange={(e) => setPendingIndexer({ ...pendingIndexer, name: e.target.value })}
                  placeholder={
                    INDEXER_TYPES.find((t) => t.value === pendingIndexer.type)?.defaultName
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="nv-label">URL *</label>
                <input
                  className="nv-input w-full"
                  type="url"
                  value={pendingIndexer.url}
                  onChange={(e) => setPendingIndexer({ ...pendingIndexer, url: e.target.value })}
                  placeholder={
                    INDEXER_TYPES.find((t) => t.value === pendingIndexer.type)?.defaultUrl
                  }
                />
              </div>

              {/* API Key with ⓘ icon — help text changes per type */}
              <div className="space-y-2">
                <ApiKeyLabel
                  onInfo={() =>
                    setApiInfoModal(API_KEY_HELP[pendingIndexer.type] ?? "")
                  }
                />
                <input
                  className="nv-input w-full font-mono"
                  value={pendingIndexer.apiKey}
                  onChange={(e) =>
                    setPendingIndexer({ ...pendingIndexer, apiKey: e.target.value })
                  }
                  placeholder={
                    pendingIndexer.type === "nzbhydra2"
                      ? "API key (optional if auth disabled)"
                      : `Your ${INDEXER_TYPES.find((t) => t.value === pendingIndexer.type)?.label} API key`
                  }
                />
              </div>

              {/* Test button centered at bottom of box */}
              <div className="pt-1 flex justify-center">
                <TestButton
                  onTest={testIndexer}
                  testing={testingIndexer}
                  status={indexerTestStatus}
                  disabled={!pendingIndexer.url}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addIndexer}
              disabled={!pendingIndexer.url || !pendingIndexer.apiKey}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Indexer Client
            </button>

            <StepFooter
              onBack={() => setCurrentStep(1)}
              onNext={() => goToStep(3)}
              loading={false}
              nextLabel="Continue"
            />
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-5">
            <StepHeader
              title="Download Client"
              description="Connect any download client to enable the download handler."
            />

            <div className="nv-card p-5 space-y-4 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">Type</label>
                <select
                  className="nv-input w-full"
                  value={pendingClient.type}
                  onChange={(e) => {
                    const newType = e.target.value as ClientItem["type"];
                    const label =
                      CLIENT_TYPE_GROUPS.flatMap((g) => g.options).find(
                        (o) => o.value === newType,
                      )?.label ?? pendingClient.name;
                    setPendingClient({
                      ...pendingClient,
                      type: newType,
                      name: label,
                      url: defaultServiceUrl(newType),
                    });
                    setClientTestStatus(null);
                  }}
                >
                  {CLIENT_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.group} label={`── ${group.group} ──`}>
                      {group.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="nv-label">Display Name</label>
                  <input
                    className="nv-input w-full"
                    value={pendingClient.name}
                    onChange={(e) =>
                      setPendingClient({ ...pendingClient, name: e.target.value })
                    }
                    placeholder="SABnzbd"
                  />
                </div>
                <div className="space-y-2">
                  <label className="nv-label">Category</label>
                  <input
                    className="nv-input w-full"
                    value={pendingClient.category}
                    onChange={(e) =>
                      setPendingClient({ ...pendingClient, category: e.target.value })
                    }
                    placeholder="snatcharr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="nv-label">URL *</label>
                <input
                  className="nv-input w-full"
                  type="url"
                  value={pendingClient.url}
                  onChange={(e) => setPendingClient({ ...pendingClient, url: e.target.value })}
                  placeholder={defaultServiceUrl(pendingClient.type)}
                />
              </div>

              <div className="space-y-2">
                <ApiKeyLabel
                  onInfo={() =>
                    setApiInfoModal(API_KEY_HELP[pendingClient.type] ?? "")
                  }
                />
                <input
                  className="nv-input w-full font-mono"
                  value={pendingClient.apiKey}
                  onChange={(e) =>
                    setPendingClient({ ...pendingClient, apiKey: e.target.value })
                  }
                  placeholder="API Key"
                />
              </div>

              <div className="pt-1 flex justify-center">
                <TestButton
                  onTest={testClient}
                  testing={testingClient}
                  status={clientTestStatus}
                  disabled={!pendingClient.url || !pendingClient.apiKey}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addClient}
              disabled={!pendingClient.url || !pendingClient.apiKey}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Download Client
            </button>

            <StepFooter
              onBack={() => setCurrentStep(2)}
              onNext={() => goToStep(4)}
              loading={false}
              nextLabel="Continue"
            />
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-5">
            <StepHeader
              title="Additional Apps"
              description="Connect additional but not needed apps for features like login authentication or sync user data."
            />

            <div className="nv-card p-5 space-y-4 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">App Type</label>
                <select
                  className="nv-input w-full"
                  value={pendingApp.type}
                  onChange={(e) => {
                    const type = e.target.value as AppItem["type"];
                    setPendingApp(blankApp(type));
                    setAppTestStatus(null);
                  }}
                >
                  {SETUP_APP_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <label className="nv-label">Display Name</label>
                  <input
                    className="nv-input w-full"
                    value={pendingApp.name}
                    onChange={(e) => setPendingApp({ ...pendingApp, name: e.target.value })}
                    placeholder={
                      SETUP_APP_OPTIONS.find((t) => t.value === pendingApp.type)?.label
                    }
                  />
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Additional App Features:
                  </p>
                  <ul className="space-y-1">
                    {(ADDITIONAL_APP_TYPES[pendingApp.type]?.features ?? []).map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-1.5 text-xs text-foreground/80"
                      >
                        <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-primary font-medium pt-2">{ADDITIONAL_APP_LOGIN_NOTE}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="nv-label">URL *</label>
                <input
                  className="nv-input w-full"
                  type="url"
                  value={pendingApp.url}
                  onChange={(e) => setPendingApp({ ...pendingApp, url: e.target.value })}
                  placeholder={defaultServiceUrl(pendingApp.type)}
                />
              </div>

              <div className="space-y-2">
                <ApiKeyLabel
                  onInfo={() =>
                    setApiInfoModal(API_KEY_HELP[pendingApp.type] ?? "")
                  }
                />
                <input
                  className="nv-input w-full font-mono"
                  value={pendingApp.apiKey}
                  onChange={(e) => setPendingApp({ ...pendingApp, apiKey: e.target.value })}
                  placeholder="API Key (optional for some apps)"
                />
              </div>

              <div className="pt-1 flex justify-center">
                <TestButton
                  onTest={testApp}
                  testing={testingApp}
                  status={appTestStatus}
                  disabled={!pendingApp.url}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addApp}
              disabled={!pendingApp.url}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Additional App
            </button>

            <StepFooter
              onBack={() => setCurrentStep(3)}
              onNext={() => goToStep(5)}
              loading={false}
              nextLabel="Continue"
            />
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-5">
            <StepHeader
              title="General Settings"
              description="Configure basic behaviour and access control for your Snatcharr instance."
            />

            <div className="nv-card p-5 space-y-5 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">Authentication Method</label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Same options as Settings → Security. External providers need a matching app from Step 4.
                </p>
                <select
                  className="nv-input w-full"
                  value={generalSettings.authMethod}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      authMethod: e.target.value as GeneralSettingsData["authMethod"],
                    })
                  }
                >
                  <option value="local">Local (Username / Password)</option>
                  <option value="jellyfin" disabled={!hasJellyfin}>
                    Jellyfin{hasJellyfin ? "" : " (add Jellyfin app first)"}
                  </option>
                  <option value="seerr-local" disabled={!hasSeerr}>
                    Seerr — local account{hasSeerr ? "" : " (add Seerr app first)"}
                  </option>
                  <option value="seerr-jellyfin" disabled={!hasSeerr}>
                    Seerr — via Jellyfin{hasSeerr ? "" : " (add Seerr app first)"}
                  </option>
                  <option value="seerr-jellyfin-fallback" disabled={!hasSeerr || !hasJellyfin}>
                    Seerr Jellyfin + Jellyfin fallback
                    {hasSeerr && hasJellyfin ? "" : " (needs Seerr & Jellyfin)"}
                  </option>
                  <option value="organizr" disabled={!hasOrganizr}>
                    Organizr v2{hasOrganizr ? "" : " (add Organizr app first)"}
                  </option>
                </select>
              </div>

              <div className="border-t border-border/60 pt-4 space-y-4">
                <SettingsToggle
                  label="Allow public signup"
                  description="Users can register from the login screen (same as Settings → Security)"
                  value={generalSettings.signupEnabled}
                  onChange={(v) =>
                    setGeneralSettings({ ...generalSettings, signupEnabled: v })
                  }
                />

                <SettingsToggle
                  label="Email address required"
                  description="Only enforced with SMTP (step Email) or a Jellyfin/Seerr sync app. Auth/sync auto-verifies; local users need SMTP or admin approval."
                  value={generalSettings.requireEmail}
                  onChange={(v) =>
                    setGeneralSettings({ ...generalSettings, requireEmail: v })
                  }
                />

                <SettingsToggle
                  label="Grant required to use the app"
                  description="New users cannot search or grab until an admin grants access (Users → can grab)"
                  value={generalSettings.requireAppGrant}
                  onChange={(v) =>
                    setGeneralSettings({ ...generalSettings, requireAppGrant: v })
                  }
                />
              </div>

              <div className="border-t border-border/60 pt-4 space-y-4">
                <div className="space-y-2">
                  <label className="nv-label">Limit search requests / day (all users)</label>
                  <p className="text-xs text-muted-foreground -mt-1">0 = unlimited. Resets daily at 11:00 AM.</p>
                  <input
                    type="number"
                    min={0}
                    className="nv-input w-32"
                    value={generalSettings.maxSearchRequestsPerUserPerDay}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        maxSearchRequestsPerUserPerDay: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="nv-label">Limit grabs / day (all users)</label>
                  <p className="text-xs text-muted-foreground -mt-1">0 = unlimited. Resets daily at 11:00 AM.</p>
                  <input
                    type="number"
                    min={0}
                    className="nv-input w-32"
                    value={generalSettings.maxGrabsPerUserPerDay}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        maxGrabsPerUserPerDay: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="border-t border-border/60 pt-4 space-y-4">
                <div className="space-y-2">
                  <label className="nv-label">Show Disclaimer when open Snatcharr</label>
                  <select
                    className="nv-input w-full"
                    value={generalSettings.warningOnOpen}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        warningOnOpen: e.target.value as GeneralSettingsData["warningOnOpen"],
                      })
                    }
                  >
                    <option value="once">Once (per session)</option>
                    <option value="always">Always</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                {generalSettings.warningOnOpen !== "disabled" && (
                  <div className="space-y-2">
                    <label className="nv-label">Disclaimer text</label>
                    <textarea
                      className="nv-input w-full min-h-28 resize-y"
                      placeholder="Disclaimer, rules or notice"
                      value={generalSettings.importantPopupText}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          importantPopupText: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Final step — no skip, Complete Setup button */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => goToStep(4)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        Snatcharr v1.0 · All settings can be changed later in Settings
      </p>

      </div>
      </main>

      {/* API Key Info Modal — outside main so it always covers the full page */}
      {apiInfoModal !== null && (
        <ApiKeyInfoModal text={apiInfoModal} onClose={() => setApiInfoModal(null)} />
      )}
    </div>
  );
}


function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ApiKeyLabel({ onInfo }: { onInfo: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="nv-label">API Key *</label>
      <button
        type="button"
        onClick={onInfo}
        tabIndex={-1}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        aria-label="API key help"
      >
        <Info className="h-3.5 w-3.5" />
        <span>Where to find?</span>
      </button>
    </div>
  );
}

function TestButton({
  onTest,
  testing,
  status,
  disabled,
}: {
  onTest: () => void;
  testing: boolean;
  status: "success" | "error" | null;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTest}
      disabled={testing || disabled}
      className={cn(
        "flex items-center gap-2 px-5 py-2 border rounded-md text-sm font-medium transition-all",
        status === "success" &&
          "border-green-500 text-green-400 bg-green-500/10",
        status === "error" &&
          "border-destructive text-destructive bg-destructive/10",
        !status && "border-border hover:bg-muted",
        (testing || disabled) && "opacity-50 cursor-not-allowed",
      )}
    >
      {testing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : status === "success" ? (
        <Check className="h-4 w-4" />
      ) : status === "error" ? (
        <X className="h-4 w-4" />
      ) : (
        <Search className="h-4 w-4" />
      )}
      {testing
        ? "Testing…"
        : status === "success"
        ? "Connected"
        : status === "error"
        ? "Failed — Retry"
        : "Test Connection"}
    </button>
  );
}

function StepFooter({
  onBack,
  onNext,
  loading,
  nextLabel,
  isFirst,
  leftAction,
}: {
  onBack?: () => void;
  onNext?: () => void;
  loading: boolean;
  nextLabel: string;
  isFirst?: boolean;
  leftAction?: React.ReactNode;
}) {
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {leftAction}
          {!isFirst && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          ) : null}
        </div>

        <button
          type={onNext ? "button" : "submit"}
          onClick={onNext}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AddedItemRow({
  label,
  sub,
  onRemove,
}: {
  label: string;
  sub: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-green-500/10 border border-green-500/25 text-sm">
      <Check className="h-4 w-4 text-green-400 shrink-0" />
      <span className="font-medium flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground truncate max-w-40">{sub}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        aria-label="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SettingsToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "relative shrink-0 w-11 h-6 rounded-full border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-0.5",
          value
            ? "bg-primary border-primary"
            : "bg-muted-foreground/25 border-muted-foreground/40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-all duration-200",
            value ? "bg-white translate-x-5" : "bg-muted-foreground",
          )}
        />
      </button>
    </div>
  );
}

function ApiKeyInfoModal({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">Where to find your API Key</h3>
          <button
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{text}</p>
        </div>
        <div className="p-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function LogoImage({ size = 52 }: { size?: number }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-2xl bg-primary/10 flex items-center justify-center shrink-0"
      >
        <Shield
          style={{ width: size * 0.45, height: size * 0.45 }}
          className="text-primary"
        />
      </div>
    );
  }
  return (
    <Image
      src="/logo.png"
      alt="Snatcharr logo"
      width={size}
      height={size}
      className="rounded-2xl shrink-0"
      priority
      onError={() => setErrored(true)}
    />
  );
}
