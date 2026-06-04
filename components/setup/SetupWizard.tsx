"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, User, Search, Download, Layers, Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

interface AdminData {
  username: string;
  password: string;
  confirmPassword: string;
}

interface IndexerData {
  name: string;
  prowlarrUrl: string;
  apiKey: string;
  categories: string;
}

interface ClientData {
  name: string;
  type: "sabnzbd" | "nzbget";
  url: string;
  apiKey: string;
  category: string;
}

interface AppsData {
  jellyfinUrl: string;
  jellyfinApiKey: string;
  jellyseerrUrl: string;
  jellyseerrApiKey: string;
}

const STEPS = [
  { id: 1, label: "Admin Account", icon: User },
  { id: 2, label: "Prowlarr Indexer", icon: Search },
  { id: 3, label: "Download Client", icon: Download },
  { id: 4, label: "External Apps", icon: Layers },
];

export default function SetupWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [testingIndexer, setTestingIndexer] = useState(false);
  const [testingClient, setTestingClient] = useState(false);

  const [adminData, setAdminData] = useState<AdminData>({
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [indexerData, setIndexerData] = useState<IndexerData>({
    name: "Prowlarr",
    prowlarrUrl: "http://localhost:9696",
    apiKey: "",
    categories: "",
  });

  const [clientData, setClientData] = useState<ClientData>({
    name: "SABnzbd",
    type: "sabnzbd",
    url: "http://localhost:8080",
    apiKey: "",
    category: "snatcharr",
  });

  const [appsData, setAppsData] = useState<AppsData>({
    jellyfinUrl: "",
    jellyfinApiKey: "",
    jellyseerrUrl: "",
    jellyseerrApiKey: "",
  });

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
    setCurrentStep(2);
  }

async function testProwlarr() {
    if (!indexerData.prowlarrUrl || !indexerData.apiKey) {
      toast.error("Bitte URL und API-Key ausfüllen");
      return;
    }

    setTestingIndexer(true);
    try {
      const res = await fetch("/api/setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "prowlarr",
          url: indexerData.prowlarrUrl,
          apiKey: indexerData.apiKey,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("✅ Verbindung zu Prowlarr erfolgreich!");
      } else {
        toast.error(data.error || "Verbindung fehlgeschlagen");
      }
    } catch (err) {
      toast.error("Verbindung fehlgeschlagen");
    } finally {
      setTestingIndexer(false);
    }
  }

  async function testDownloadClient() {
    if (!clientData.url || !clientData.apiKey) {
      toast.error("Bitte URL und API-Key ausfüllen");
      return;
    }

    setTestingClient(true);
    try {
      const res = await fetch("/api/setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: clientData.type,
          url: clientData.url,
          apiKey: clientData.apiKey,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`✅ Verbindung zu ${clientData.name} erfolgreich!`);
      } else {
        toast.error(data.error || "Verbindung fehlgeschlagen");
      }
    } catch (err) {
      toast.error("Verbindung fehlgeschlagen");
    } finally {
      setTestingClient(false);
    }
  }

  async function handleIndexerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!indexerData.prowlarrUrl || !indexerData.apiKey) {
      toast.error("Please fill in the required fields");
      return;
    }
    setCurrentStep(3);
  }

  async function handleClientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCurrentStep(4);
  }

  async function handleFinish() {
    setLoading(true);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin: adminData,
          indexer: indexerData.apiKey ? indexerData : null,
          downloadClient: clientData.apiKey ? clientData : null,
          apps: appsData,
        }),
      });

      const data = (await response.json()) as { error?: string };

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

  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Snatcharr</h1>
        </div>
        <p className="text-muted-foreground">Initial Setup Wizard</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const state =
            step.id < currentStep ? "completed" : step.id === currentStep ? "current" : "pending";
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    state === "completed" && "bg-green-500 border-green-500",
                    state === "current" && "border-primary bg-primary/10",
                    state === "pending" && "border-border bg-card",
                  )}
                >
                  {state === "completed" ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        state === "current" ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs mt-1 font-medium",
                    state === "current" ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-12 sm:w-20 mx-2 mt-[-12px] transition-colors",
                    step.id < currentStep ? "bg-green-500" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="nv-card p-6 sm:p-8">
        {currentStep === 1 && (
          <form onSubmit={handleAdminSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-1">Create Admin Account</h2>
              <p className="text-sm text-muted-foreground">This will be the primary administrator account.</p>
            </div>

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
                onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                required
              />
            </div>

            <WizardActions onNext={() => {}} isFirst loading={false} nextLabel="Continue" />
          </form>
        )}

        {currentStep === 2 && (
          <form onSubmit={handleIndexerSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-1">Add Prowlarr Indexer</h2>
              <p className="text-sm text-muted-foreground">
                Connect to your Prowlarr instance to enable searching.
                <SkipButton onClick={() => setCurrentStep(3)} />
              </p>
            </div>

            <div className="space-y-2">
              <label className="nv-label">Display Name</label>
              <input
                className="nv-input w-full"
                value={indexerData.name}
                onChange={(e) => setIndexerData({ ...indexerData, name: e.target.value })}
                placeholder="Prowlarr"
              />
            </div>

            <div className="space-y-2">
              <label className="nv-label">Prowlarr URL *</label>
              <input
                className="nv-input w-full"
                type="url"
                value={indexerData.prowlarrUrl}
                onChange={(e) => setIndexerData({ ...indexerData, prowlarrUrl: e.target.value })}
                placeholder="http://localhost:9696"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="nv-label">API Key *</label>
              <input
                className="nv-input w-full font-mono"
                value={indexerData.apiKey}
                onChange={(e) => setIndexerData({ ...indexerData, apiKey: e.target.value })}
                placeholder="Your Prowlarr API key"
                required
              />
              <p className="text-xs text-muted-foreground">
                Find it in Prowlarr → Settings → General → Security
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={testProwlarr}
                disabled={testingIndexer || !indexerData.prowlarrUrl || !indexerData.apiKey}
                className="flex items-center gap-2 px-5 py-2 border border-border hover:bg-muted rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                {testingIndexer ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Verbindung testen
              </button>
            </div>

            <WizardActions onNext={() => setCurrentStep(1)} loading={false} nextLabel="Continue" />
          </form>
        )}

        {currentStep === 3 && (
          <form onSubmit={handleClientSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-1">Add Download Client</h2>
              <p className="text-sm text-muted-foreground">
                Connect SABnzbd or NZBGet to handle downloads.
                <SkipButton onClick={() => setCurrentStep(4)} />
              </p>
            </div>

            <div className="space-y-2">
              <label className="nv-label">Type</label>
              <select
                className="nv-input w-full"
                value={clientData.type}
                onChange={(e) =>
                  setClientData({ ...clientData, type: e.target.value as "sabnzbd" | "nzbget" })
                }
              >
                <option value="sabnzbd">SABnzbd</option>
                <option value="nzbget">NZBGet</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="nv-label">Display Name</label>
              <input
                className="nv-input w-full"
                value={clientData.name}
                onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                placeholder="SABnzbd"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="nv-label">URL *</label>
                <input
                  className="nv-input w-full"
                  type="url"
                  value={clientData.url}
                  onChange={(e) => setClientData({ ...clientData, url: e.target.value })}
                  placeholder="http://localhost:8080"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="nv-label">Category</label>
                <input
                  className="nv-input w-full"
                  value={clientData.category}
                  onChange={(e) => setClientData({ ...clientData, category: e.target.value })}
                  placeholder="snatcharr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="nv-label">API Key *</label>
              <input
                className="nv-input w-full font-mono"
                value={clientData.apiKey}
                onChange={(e) => setClientData({ ...clientData, apiKey: e.target.value })}
                placeholder="API Key"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={testDownloadClient}
                disabled={testingClient || !clientData.url || !clientData.apiKey}
                className="flex items-center gap-2 px-5 py-2 border border-border hover:bg-muted rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                {testingClient ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Verbindung testen
              </button>
            </div>

            <WizardActions onNext={() => setCurrentStep(2)} loading={false} nextLabel="Continue" />
          </form>
        )}

        {currentStep === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-1">External Apps (Optional)</h2>
              <p className="text-sm text-muted-foreground">
                Connect Jellyfin and Jellyseerr for user sync and authentication.
              </p>
            </div>

            <div className="space-y-4">
              <div className="nv-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Jellyfin</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">URL</label>
                    <input
                      className="nv-input w-full"
                      value={appsData.jellyfinUrl}
                      onChange={(e) => setAppsData({ ...appsData, jellyfinUrl: e.target.value })}
                      placeholder="http://localhost:8096"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">API Key</label>
                    <input
                      className="nv-input w-full font-mono"
                      value={appsData.jellyfinApiKey}
                      onChange={(e) => setAppsData({ ...appsData, jellyfinApiKey: e.target.value })}
                      placeholder="API Key"
                    />
                  </div>
                </div>
              </div>

              <div className="nv-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Jellyseerr</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">URL</label>
                    <input
                      className="nv-input w-full"
                      value={appsData.jellyseerrUrl}
                      onChange={(e) => setAppsData({ ...appsData, jellyseerrUrl: e.target.value })}
                      placeholder="http://localhost:5055"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">API Key</label>
                    <input
                      className="nv-input w-full font-mono"
                      value={appsData.jellyseerrApiKey}
                      onChange={(e) => setAppsData({ ...appsData, jellyseerrApiKey: e.target.value })}
                      placeholder="API Key"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
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
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Setting up...
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
  );
}

function SkipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-2 text-primary hover:underline text-xs font-medium"
    >
      Skip this step →
    </button>
  );
}

function WizardActions({
  onNext,
  isFirst,
  loading,
  nextLabel,
}: {
  onNext: () => void;
  isFirst?: boolean;
  loading: boolean;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {!isFirst ? (
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      ) : (
        <div />
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {nextLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
