"use client";

import { ADDITIONAL_APP_TYPES, type AdditionalAppType } from "@/lib/additional-app-types";
import { getCatalog } from "@/lib/i18n/catalog";
import { I18nProvider, useLocale, useT } from "@/lib/i18n/client";
import { resolveLocale, SUPPORTED_LOCALES, type LocaleCode } from "@/lib/i18n/config";
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
import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
  { id: 1, labelKey: "setup.steps.admin", icon: User },
  { id: 2, labelKey: "setup.steps.indexer", icon: Search },
  { id: 3, labelKey: "setup.steps.client", icon: Download },
  { id: 4, labelKey: "setup.steps.apps", icon: Layers },
  { id: 5, labelKey: "setup.steps.general", icon: Settings },
] as const;

const CLIENT_TYPE_GROUPS: Array<{
  groupKey: string;
  options: Array<{ value: ClientItem["type"]; label: string }>;
}> = [
  {
    groupKey: "setup.groupUsenet",
    options: [
      { value: "sabnzbd", label: "SABnzbd" },
      { value: "nzbget", label: "NZBGet" },
    ],
  },
  {
    groupKey: "setup.groupTorrent",
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

const AUTH_INFO_METHODS = [
  "local",
  "jellyfin",
  "seerr-local",
  "seerr-jellyfin",
  "seerr-jellyfin-fallback",
  "organizr",
] as const;

function authMethodInfoKey(method: string): string {
  return AUTH_INFO_METHODS.includes(method as (typeof AUTH_INFO_METHODS)[number])
    ? `setup.authInfo.${method}`
    : "setup.authInfo.local";
}


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
  setupStatus,
}: {
  prefill?: SetupPrefillData;
  setupStatus: SetupPageStatus;
}) {
  const parentLocale = useLocale();
  const [setupLocale, setSetupLocale] = useState<LocaleCode>(() =>
    resolveLocale(prefill?.generalSettings?.uiLanguage ?? parentLocale),
  );

  return (
    <I18nProvider locale={setupLocale} dictionary={getCatalog(setupLocale)}>
      <SetupWizardInner
        prefill={prefill}
        setupStatus={setupStatus}
        setupLocale={setupLocale}
        onLocaleChange={setSetupLocale}
      />
    </I18nProvider>
  );
}

function SetupWizardInner({
  prefill,
  setupStatus: initialSetupStatus,
  setupLocale,
  onLocaleChange,
}: {
  prefill?: SetupPrefillData;
  setupStatus: SetupPageStatus;
  setupLocale: LocaleCode;
  onLocaleChange: (locale: LocaleCode) => void;
}) {
  const t = useT();
  const router = useRouter();
  const prefillNotified = useRef(false);
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
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
    uiLanguage: prefill?.generalSettings?.uiLanguage ?? "en",
    userDownloadSpeedLimitMbit: prefill?.generalSettings?.userDownloadSpeedLimitMbit ?? 0,
    warningOnOpen: prefill?.generalSettings?.warningOnOpen ?? "once",
    importantPopupText: prefill?.generalSettings?.importantPopupText ?? "",
  });
  const [configLoaded, setConfigLoaded] = useState(false);
  const configFileInputRef = useRef<HTMLInputElement>(null);

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
      const uiLanguage = resolveLocale(data.generalSettings.uiLanguage ?? setupLocale);
      setGeneralSettings({
        authMethod: data.generalSettings.authMethod ?? "local",
        signupEnabled: data.generalSettings.signupEnabled ?? false,
        requireEmail: data.generalSettings.requireEmail ?? false,
        requireAppGrant: data.generalSettings.requireAppGrant ?? false,
        maxSearchRequestsPerUserPerDay: data.generalSettings.maxSearchRequestsPerUserPerDay ?? 0,
        maxGrabsPerUserPerDay: data.generalSettings.maxGrabsPerUserPerDay ?? 0,
        uiLanguage,
        userDownloadSpeedLimitMbit: data.generalSettings.userDownloadSpeedLimitMbit ?? 0,
        warningOnOpen: data.generalSettings.warningOnOpen ?? "once",
        importantPopupText: data.generalSettings.importantPopupText ?? "",
      });
      onLocaleChange(uiLanguage);
    }
    setConfigLoaded(true);
  }

  useEffect(() => {
    if (!configLoaded || prefillNotified.current) return;
    prefillNotified.current = true;
    toast.message(t("setup.toastConfigLoadedReenter"));
  }, [configLoaded, t]);

  async function persistProgress(overrides?: {
    indexers?: IndexerItem[];
    clients?: ClientItem[];
    apps?: AppItem[];
    generalSettings?: GeneralSettingsData;
  }) {
    try {
      await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveProgress",
          indexers: overrides?.indexers ?? addedIndexers,
          clients: overrides?.clients ?? addedClients,
          apps: overrides?.apps ?? addedApps,
          generalSettings: overrides?.generalSettings ?? generalSettings,
        }),
      });
    } catch {
      // best-effort
    }
  }

  async function goToStep(
    step: Step,
    overrides?: {
      indexers?: IndexerItem[];
      clients?: ClientItem[];
      apps?: AppItem[];
      generalSettings?: GeneralSettingsData;
    },
  ) {
    await persistProgress(overrides);
    setCurrentStep(step);
  }

  const [infoModal, setInfoModal] = useState<{ title: string; text: string } | null>(null);


  async function testIndexer() {
    if (!pendingIndexer.url || !pendingIndexer.apiKey) {
      toast.error(t("setup.toastEnterUrlApiKey"));
      return;
    }
    if (!pendingIndexer.url.startsWith("http")) {
      toast.error(t("setup.toastUrlHttp"));
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
          type: pendingIndexer.type,
          url: pendingIndexer.url,
          apiKey: pendingIndexer.apiKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIndexerTestStatus("success");
        setPendingIndexer((prev) => ({ ...prev, tested: true }));
        toast.success(t("setup.toastIndexerConnected"));
      } else {
        setIndexerTestStatus("error");
        toast.error(data.error ?? t("setup.toastConnectionFailed"));
      }
    } catch {
      setIndexerTestStatus("error");
      toast.error(t("setup.toastConnectionFailed"));
    } finally {
      setTestingIndexer(false);
      setTimeout(() => setIndexerTestStatus(null), 3000);
    }
  }

  async function testClient() {
    if (!pendingClient.url || !pendingClient.apiKey) {
      toast.error(t("setup.toastEnterUrlApiKey"));
      return;
    }
    if (!pendingClient.url.startsWith("http")) {
      toast.error(t("setup.toastUrlHttp"));
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
        toast.success(t("setup.toastClientConnected"));
      } else {
        setClientTestStatus("error");
        toast.error(data.error ?? t("setup.toastConnectionFailed"));
      }
    } catch {
      setClientTestStatus("error");
      toast.error(t("setup.toastConnectionFailed"));
    } finally {
      setTestingClient(false);
      setTimeout(() => setClientTestStatus(null), 3000);
    }
  }

  async function testApp() {
    if (!pendingApp.url) {
      toast.error(t("setup.toastEnterUrl"));
      return;
    }
    if (!pendingApp.url.startsWith("http")) {
      toast.error(t("setup.toastUrlHttp"));
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
        toast.success(t("setup.toastAppConnected"));
      } else {
        setAppTestStatus("error");
        toast.error(data.error ?? t("setup.toastConnectionFailed"));
      }
    } catch {
      setAppTestStatus("error");
      toast.error(t("setup.toastConnectionFailed"));
    } finally {
      setTestingApp(false);
      setTimeout(() => setAppTestStatus(null), 3000);
    }
  }


  function addIndexer() {
    if (!pendingIndexer.tested) {
      toast.error(t("setup.toastTestRequired"));
      return;
    }
    setAddedIndexers((prev) => [...prev, { ...pendingIndexer }]);
    setPendingIndexer(blankIndexer());
    setIndexerTestStatus(null);
    toast.success(t("setup.toastItemAdded", { name: pendingIndexer.name }));
  }

  function addClient() {
    if (!pendingClient.tested) {
      toast.error(t("setup.toastTestRequired"));
      return;
    }
    setAddedClients((prev) => [...prev, { ...pendingClient }]);
    setPendingClient(blankClient());
    setClientTestStatus(null);
    toast.success(t("setup.toastItemAdded", { name: pendingClient.name }));
  }

  function addApp() {
    if (!pendingApp.tested) {
      toast.error(t("setup.toastTestRequired"));
      return;
    }
    const name =
      pendingApp.name ||
      SETUP_APP_OPTIONS.find((o) => o.value === pendingApp.type)?.label ||
      "";
    setAddedApps((prev) => [...prev, { ...pendingApp }]);
    setPendingApp(blankApp());
    setAppTestStatus(null);
    toast.success(t("setup.toastItemAdded", { name }));
  }

  async function confirmLanguageAndStart() {
    const nextSettings = { ...generalSettings, uiLanguage: setupLocale };
    setGeneralSettings(nextSettings);
    await persistProgress({ generalSettings: nextSettings });
    setLanguageConfirmed(true);
    setCurrentStep(1);
  }


  const adminReady =
    setupStatus.hasPrimaryLocalAdmin && !setupStatus.adminNeedsPassword;

  function openConfigFilePicker() {
    if (!adminReady) {
      toast.error(t("setup.toastCreateAdminFirst"));
      return;
    }
    configFileInputRef.current?.click();
  }

  async function onConfigFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!adminReady) {
      toast.error(t("setup.toastCreateAdminFirst"));
      return;
    }
    setLoadingConfig(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error(t("setup.toastConfigInvalid"));
        return;
      }
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importConfig", config: parsed }),
      });
      const data = (await res.json()) as SetupPrefillData & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? t("setup.toastConfigLoadFailed"));
        return;
      }
      applyPrefill(data);
      toast.success(t("setup.toastConfigLoaded"));
    } catch {
      toast.error(t("setup.toastConfigLoadFailed"));
    } finally {
      setLoadingConfig(false);
    }
  }

  async function createAdmin() {
    if (adminData.password !== adminData.confirmPassword) {
      toast.error(t("setup.toastPasswordsMismatch"));
      return;
    }
    if (adminData.password.length < 8) {
      toast.error(t("setup.toastPasswordMin"));
      return;
    }
    if (!adminData.username.trim()) {
      toast.error(t("setup.toastUsernameRequired"));
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
        toast.error(data.error ?? t("setup.toastAdminSaveFailed"));
        return;
      }
      if (data.finished) {
        toast.success(t("setup.toastAdminCreatedRedirect"));
        router.push("/login");
        return;
      }
      const statusRes = await fetch("/api/setup");
      if (statusRes.ok) {
        const statusData = (await statusRes.json()) as { status?: SetupPageStatus };
        if (statusData.status) setSetupStatus(statusData.status);
      }
      toast.success(t("setup.toastAdminCreated"));
    } catch {
      toast.error(t("setup.toastAdminSaveFailed"));
    } finally {
      setLoading(false);
    }
  }

  function continueAfterAdmin() {
    if (!adminReady) {
      toast.error(t("setup.toastCreateAdminFirst"));
      return;
    }
    void goToStep(2);
  }

  function selectSetupLanguage(code: string) {
    const locale = resolveLocale(code);
    onLocaleChange(locale);
    setGeneralSettings((prev) => ({ ...prev, uiLanguage: locale }));
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
      const data = (await response.json()) as {
        error?: string;
        details?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      };
      if (!response.ok) {
        const fieldMsg = data.details?.fieldErrors
          ? Object.entries(data.details.fieldErrors)
              .flatMap(([k, v]) => (v ?? []).map((m) => `${k}: ${m}`))
              .slice(0, 2)
              .join("; ")
          : "";
        toast.error(fieldMsg || data.error || t("setup.toastSetupFailed"));
        return;
      }
      toast.success(t("setup.toastSetupComplete"));
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      toast.error(t("setup.toastSetupFailedRetry"));
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
      label: ap.name || SETUP_APP_OPTIONS.find((o) => o.value === ap.type)?.label || ap.type,
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
          <p className="text-xs text-muted-foreground">{t("setup.wizardTitle")}</p>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pt-10 pb-8">
      <div className="w-full max-w-2xl">

      {!languageConfirmed ? (
        <div className="nv-card p-6 sm:p-8 space-y-6">
          <StepHeader
            title={t("setup.languageTitle")}
            description={t("setup.languageDesc")}
          />
          <div className="nv-card p-5 bg-muted/20">
            <div className="flex items-center justify-between gap-4">
              <label className="nv-label shrink-0">{t("settings.general.language")}</label>
              <select
                className="nv-input w-full max-w-xs ml-auto"
                value={setupLocale}
                onChange={(e) => selectSetupLanguage(e.target.value)}
                autoFocus
              >
                {SUPPORTED_LOCALES.map((locale) => (
                  <option key={locale.code} value={locale.code}>
                    {locale.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <StepFooter
            isFirst
            loading={false}
            onNext={() => void confirmLanguageAndStart()}
            nextLabel={t("setup.next")}
          />
        </div>
      ) : (
        <>
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
                  {t(step.labelKey)}
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
          <p className="text-sm font-medium text-primary">{t("setup.configLoadedTitle")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("setup.configLoadedCounts", {
              indexers: addedIndexers.length,
              clients: addedClients.length,
              apps: addedApps.length,
            })}
            {adminData.username ? t("setup.prefillAdmin", { username: adminData.username }) : ""}{" "}
            {t("setup.prefillPasswordHint")}
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
                aria-label={t("setup.removeBadge", { label: b.label })}
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createAdmin();
            }}
            className="space-y-6"
          >
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm space-y-1.5">
              <p className="text-foreground">
                {t("setup.database")}{" "}
                <code className="text-xs bg-muted px-1 rounded break-all">{setupStatus.dbPath}</code>
              </p>
              <p className={adminReady ? "text-green-400" : "text-muted-foreground"}>
                {adminReady ? t("setup.localAdminFound") : t("setup.localAdminNotFound")}
              </p>
            </div>

            <div className="nv-card p-5 space-y-4 bg-muted/20">
              {!adminReady ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-400">
                    {t("setup.localAdminRequiredTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("setup.localAdminRequiredDesc")}
                  </p>
                  {setupStatus.adminNeedsPassword && (
                    <p className="text-xs text-amber-400/90">{t("setup.adminNeedsPassword")}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-400">
                    {t("setup.adminCreatedSuccess")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("setup.nextOrLoadHint")}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="nv-label">{t("setup.usernameRequired")}</label>
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
                <label className="nv-label">{t("setup.passwordRequired")}</label>
                <input
                  className="nv-input w-full"
                  type="password"
                  placeholder={t("setup.passwordPlaceholder")}
                  value={adminData.password}
                  onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                  required={!adminReady}
                />
              </div>
              <div className="space-y-2">
                <label className="nv-label">{t("setup.confirmPasswordRequired")}</label>
                <input
                  className="nv-input w-full"
                  type="password"
                  placeholder={t("setup.confirmPasswordPlaceholder")}
                  value={adminData.confirmPassword}
                  onChange={(e) =>
                    setAdminData({ ...adminData, confirmPassword: e.target.value })
                  }
                  required={!adminReady}
                />
              </div>
              <div className="flex justify-center pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  {adminReady ? t("setup.updateAdmin") : t("setup.createAdmin")}
                </button>
              </div>
            </div>

            <input
              ref={configFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => void onConfigFileSelected(e)}
            />

            <StepFooter
              isFirst
              loading={loading}
              nextDisabled={!adminReady}
              onNext={continueAfterAdmin}
              nextLabel={t("setup.next")}
              nextTitle={
                adminReady
                  ? t("setup.continueToIndexer")
                  : t("setup.createAdminFirst")
              }
              leftAction={
                <button
                  type="button"
                  disabled={!adminReady || loadingConfig}
                  onClick={openConfigFilePicker}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={
                    !adminReady
                      ? t("setup.createAdminFirst")
                      : t("setup.loadFromConfig")
                  }
                >
                  {loadingConfig ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("common.loading")}
                    </span>
                  ) : (
                    t("setup.loadConfig")
                  )}
                </button>
              }
            />
          </form>
        )}

        {currentStep === 2 && (
          <div className="space-y-5">
            <StepHeader
              title={t("setup.indexerTitle")}
              description={t("setup.indexerDesc")}
            />
            <p className="text-xs text-muted-foreground flex gap-2 -mt-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {t("setup.testRequiredHint")}
            </p>

            <div className="nv-card p-5 space-y-4 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">{t("setup.type")}</label>
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
                <label className="nv-label">{t("setup.displayName")}</label>
                <input
                  className="nv-input w-full"
                  value={pendingIndexer.name}
                  onChange={(e) => {
                    setPendingIndexer({
                      ...pendingIndexer,
                      name: e.target.value,
                      tested: false,
                    });
                    setIndexerTestStatus(null);
                  }}
                  placeholder={
                    INDEXER_TYPES.find((o) => o.value === pendingIndexer.type)?.defaultName
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="nv-label">{t("setup.urlRequired")}</label>
                <input
                  className="nv-input w-full"
                  type="url"
                  value={pendingIndexer.url}
                  onChange={(e) => {
                    setPendingIndexer({
                      ...pendingIndexer,
                      url: e.target.value,
                      tested: false,
                    });
                    setIndexerTestStatus(null);
                  }}
                  placeholder={
                    INDEXER_TYPES.find((o) => o.value === pendingIndexer.type)?.defaultUrl
                  }
                />
              </div>

              <div className="space-y-2">
                <ApiKeyLabel
                  onInfo={() =>
                    setInfoModal({ title: t("setup.apiKeyModalTitle"), text: t(`setup.apiHelp.${pendingIndexer.type}`) })
                  }
                />
                <input
                  className="nv-input w-full font-mono"
                  value={pendingIndexer.apiKey}
                  onChange={(e) => {
                    setPendingIndexer({
                      ...pendingIndexer,
                      apiKey: e.target.value,
                      tested: false,
                    });
                    setIndexerTestStatus(null);
                  }}
                  placeholder={
                    pendingIndexer.type === "nzbhydra2"
                      ? t("setup.apiKeyOptionalNzbhydra")
                      : t("setup.apiKeyPlaceholder", {
                          name:
                            INDEXER_TYPES.find((o) => o.value === pendingIndexer.type)?.label ?? "",
                        })
                  }
                />
              </div>

              <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
                <TestButton
                  onTest={testIndexer}
                  testing={testingIndexer}
                  status={indexerTestStatus}
                  disabled={!pendingIndexer.url}
                />
                <button
                  type="button"
                  onClick={addIndexer}
                  disabled={!pendingIndexer.tested}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={
                    pendingIndexer.tested
                      ? t("setup.addIndexer")
                      : t("setup.toastTestRequired")
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t("common.add")}
                </button>
              </div>
            </div>

            <StepFooter
              onBack={() => setCurrentStep(1)}
              onNext={() => void goToStep(3)}
              loading={false}
              nextLabel={t("setup.next")}
            />
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <StepHeader
                title={t("setup.clientTitle")}
                description={t("setup.clientDesc")}
              />
              <button
                type="button"
                onClick={() =>
                  setInfoModal({
                    title: t("setup.clientGuideTitle"),
                    text: t("setup.clientGuideSabnzbd"),
                  })
                }
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-accent transition-colors"
              >
                <Info className="h-3.5 w-3.5" />
                {t("setup.clientGuide")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground flex gap-2 -mt-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {t("setup.testRequiredHint")}
            </p>

            <div className="nv-card p-5 space-y-4 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">{t("setup.type")}</label>
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
                      apiKey: "",
                      tested: false,
                    });
                    setClientTestStatus(null);
                  }}
                >
                  {CLIENT_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.groupKey} label={`-- ${t(group.groupKey)} --`}>
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
                  <label className="nv-label">{t("setup.displayName")}</label>
                  <input
                    className="nv-input w-full"
                    value={pendingClient.name}
                    onChange={(e) => {
                      setPendingClient({
                        ...pendingClient,
                        name: e.target.value,
                        tested: false,
                      });
                      setClientTestStatus(null);
                    }}
                    placeholder="SABnzbd"
                  />
                </div>
                <div className="space-y-2">
                  <label className="nv-label">{t("setup.category")}</label>
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
                <label className="nv-label">{t("setup.urlRequired")}</label>
                <input
                  className="nv-input w-full"
                  type="url"
                  value={pendingClient.url}
                  onChange={(e) => {
                    setPendingClient({
                      ...pendingClient,
                      url: e.target.value,
                      tested: false,
                    });
                    setClientTestStatus(null);
                  }}
                  placeholder={defaultServiceUrl(pendingClient.type)}
                />
              </div>

              <div className="space-y-2">
                <ApiKeyLabel
                  onInfo={() =>
                    setInfoModal({ title: t("setup.apiKeyModalTitle"), text: t(`setup.apiHelp.${pendingClient.type}`) })
                  }
                />
                <input
                  className="nv-input w-full font-mono"
                  value={pendingClient.apiKey}
                  onChange={(e) => {
                    setPendingClient({
                      ...pendingClient,
                      apiKey: e.target.value,
                      tested: false,
                    });
                    setClientTestStatus(null);
                  }}
                  placeholder={t("setup.apiKey")}
                />
              </div>

              <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
                <TestButton
                  onTest={testClient}
                  testing={testingClient}
                  status={clientTestStatus}
                  disabled={!pendingClient.url || !pendingClient.apiKey}
                />
                <button
                  type="button"
                  onClick={addClient}
                  disabled={!pendingClient.tested}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={
                    pendingClient.tested
                      ? t("setup.addClient")
                      : t("setup.toastTestRequired")
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t("common.add")}
                </button>
              </div>
            </div>

            <StepFooter
              onBack={() => setCurrentStep(2)}
              onNext={() => void goToStep(4)}
              loading={false}
              nextLabel={t("setup.next")}
            />
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-5">
            <StepHeader
              title={t("setup.appsTitle")}
              description={t("setup.appsDesc")}
            />
            <p className="text-xs text-muted-foreground flex gap-2 -mt-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {t("setup.testRequiredHint")}
            </p>

            <div className="nv-card p-5 space-y-4 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">{t("setup.appType")}</label>
                <select
                  className="nv-input w-full"
                  value={pendingApp.type}
                  onChange={(e) => {
                    const type = e.target.value as AppItem["type"];
                    setPendingApp(blankApp(type));
                    setAppTestStatus(null);
                  }}
                >
                  {SETUP_APP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <label className="nv-label">{t("setup.displayName")}</label>
                  <input
                    className="nv-input w-full"
                    value={pendingApp.name}
                    onChange={(e) => {
                      setPendingApp({
                        ...pendingApp,
                        name: e.target.value,
                        tested: false,
                      });
                      setAppTestStatus(null);
                    }}
                    placeholder={
                      SETUP_APP_OPTIONS.find((o) => o.value === pendingApp.type)?.label
                    }
                  />
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("setup.additionalAppFeatures")}
                  </p>
                  <ul className="space-y-1">
                    {(ADDITIONAL_APP_TYPES[pendingApp.type]?.features ?? []).map((feat, index) => (
                      <li
                        key={feat}
                        className="flex items-start gap-1.5 text-xs text-foreground/80"
                      >
                        <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        {t(`setup.appFeatures.${pendingApp.type}.${index}`)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-primary font-medium pt-2">{t("setup.appLoginNote")}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="nv-label">{t("setup.urlRequired")}</label>
                <input
                  className="nv-input w-full"
                  type="url"
                  value={pendingApp.url}
                  onChange={(e) => {
                    setPendingApp({
                      ...pendingApp,
                      url: e.target.value,
                      tested: false,
                    });
                    setAppTestStatus(null);
                  }}
                  placeholder={defaultServiceUrl(pendingApp.type)}
                />
              </div>

              <div className="space-y-2">
                <ApiKeyLabel
                  onInfo={() =>
                    setInfoModal({ title: t("setup.apiKeyModalTitle"), text: t(`setup.apiHelp.${pendingApp.type}`) })
                  }
                />
                <input
                  className="nv-input w-full font-mono"
                  value={pendingApp.apiKey}
                  onChange={(e) => {
                    setPendingApp({
                      ...pendingApp,
                      apiKey: e.target.value,
                      tested: false,
                    });
                    setAppTestStatus(null);
                  }}
                  placeholder={t("setup.apiKeyOptionalApps")}
                />
              </div>

              <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
                <TestButton
                  onTest={testApp}
                  testing={testingApp}
                  status={appTestStatus}
                  disabled={!pendingApp.url}
                />
                <button
                  type="button"
                  onClick={addApp}
                  disabled={!pendingApp.tested}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={
                    pendingApp.tested ? t("setup.addApp") : t("setup.toastTestRequired")
                  }
                >
                  <Plus className="h-4 w-4" />
                  {t("common.add")}
                </button>
              </div>
            </div>

            <StepFooter
              onBack={() => setCurrentStep(3)}
              onNext={() => void goToStep(5)}
              loading={false}
              nextLabel={t("setup.next")}
            />
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-5">
            <StepHeader
              title={t("setup.generalTitle")}
              description={t("setup.generalDesc")}
            />

            <div className="nv-card p-5 space-y-5 bg-muted/20">
              <div className="space-y-2">
                <label className="nv-label">{t("settings.security.authMethod")}</label>
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
                  <option value="local">{t("setup.authLocal")}</option>
                  <option value="jellyfin" disabled={!hasJellyfin}>
                    {t("setup.authJellyfin")}
                    {hasJellyfin ? "" : t("setup.authAddFirst", { app: "Jellyfin" })}
                  </option>
                  <option value="seerr-local" disabled={!hasSeerr}>
                    {t("setup.seerrLocal")}
                    {hasSeerr ? "" : t("setup.authAddFirst", { app: "Seerr" })}
                  </option>
                  <option value="seerr-jellyfin" disabled={!hasSeerr}>
                    {t("setup.seerrJellyfin")}
                    {hasSeerr ? "" : t("setup.authAddFirst", { app: "Seerr" })}
                  </option>
                  <option value="seerr-jellyfin-fallback" disabled={!hasSeerr || !hasJellyfin}>
                    {t("setup.seerrJellyfinFallback")}
                    {hasSeerr && hasJellyfin ? "" : t("setup.authNeedsBoth")}
                  </option>
                  <option value="organizr" disabled={!hasOrganizr}>
                    {t("setup.organizrV2")}
                    {hasOrganizr ? "" : t("setup.authAddFirst", { app: "Organizr" })}
                  </option>
                </select>
                <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2.5 flex gap-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t(authMethodInfoKey(generalSettings.authMethod))}
                  </p>
                </div>
              </div>

              <div className="border-t border-border/60 pt-4 space-y-4">
                <SettingsToggle
                  label={t("setup.signupLabel")}
                  description={t("setup.signupDesc")}
                  value={generalSettings.signupEnabled}
                  onChange={(v) =>
                    setGeneralSettings({ ...generalSettings, signupEnabled: v })
                  }
                />

                <SettingsToggle
                  label={t("setup.requireEmailLabel")}
                  description={t("setup.requireEmailDesc")}
                  value={generalSettings.requireEmail}
                  onChange={(v) =>
                    setGeneralSettings({ ...generalSettings, requireEmail: v })
                  }
                />

                <SettingsToggle
                  label={t("setup.appGrantLabel")}
                  description={t("setup.appGrantDesc")}
                  value={generalSettings.requireAppGrant}
                  onChange={(v) =>
                    setGeneralSettings({ ...generalSettings, requireAppGrant: v })
                  }
                />
              </div>

              <div className="border-t border-border/60 pt-4 space-y-4">
                <div className="space-y-2">
                  <label className="nv-label">{t("setup.searchLimitLabel")}</label>
                  <p className="text-xs text-muted-foreground -mt-1">{t("setup.limitHint")}</p>
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
                  <label className="nv-label">{t("setup.grabLimitLabel")}</label>
                  <p className="text-xs text-muted-foreground -mt-1">{t("setup.limitHint")}</p>
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

                <div className="space-y-2">
                  <label className="nv-label">{t("setup.downloadSpeedLabel")}</label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    {t("setup.downloadSpeedHint")}
                  </p>
                  <div className="relative w-32">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className="nv-input w-full pr-14"
                      value={generalSettings.userDownloadSpeedLimitMbit}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          userDownloadSpeedLimitMbit: Math.max(
                            0,
                            parseFloat(e.target.value) || 0,
                          ),
                        })
                      }
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                      {t("settings.security.downloadSpeedUnit")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/60 pt-4 space-y-4">
                <div className="space-y-2">
                  <label className="nv-label">{t("setup.disclaimerLabel")}</label>
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
                    <option value="once">{t("setup.disclaimerOnce")}</option>
                    <option value="always">{t("setup.disclaimerAlways")}</option>
                    <option value="disabled">{t("setup.disclaimerDisabled")}</option>
                  </select>
                </div>

                {generalSettings.warningOnOpen !== "disabled" && (
                  <div className="space-y-2">
                    <label className="nv-label">{t("setup.disclaimerText")}</label>
                    <textarea
                      className="nv-input w-full min-h-28 resize-y"
                      placeholder={t("setup.disclaimerPlaceholder")}
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

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => void goToStep(4)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ? {t("common.back")}
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
                    {t("setup.settingUp")}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {t("setup.completeSetup")}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        {t("setup.footerNote")}
      </p>

      </div>
      </main>

      {infoModal !== null && (
        <InfoModal
          title={infoModal.title}
          text={infoModal.text}
          onClose={() => setInfoModal(null)}
        />
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
  const t = useT();
  return (
    <div className="flex items-center justify-between">
      <label className="nv-label">{t("setup.apiKeyRequired")}</label>
      <button
        type="button"
        onClick={onInfo}
        tabIndex={-1}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        aria-label={t("setup.apiKeyHelp")}
      >
        <Info className="h-3.5 w-3.5" />
        <span>{t("setup.apiKeyWhere")}</span>
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
  const t = useT();
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
        ? t("setup.testing")
        : status === "success"
        ? t("setup.connected")
        : status === "error"
        ? t("setup.failedRetry")
        : t("setup.testConnection")}
    </button>
  );
}

function StepFooter({
  onBack,
  onNext,
  loading,
  nextLabel,
  nextDisabled,
  nextTitle,
  isFirst,
  leftAction,
}: {
  onBack?: () => void;
  onNext?: () => void;
  loading: boolean;
  nextLabel: string;
  nextDisabled?: boolean;
  nextTitle?: string;
  isFirst?: boolean;
  leftAction?: React.ReactNode;
}) {
  const t = useT();
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
              ? {t("common.back")}
            </button>
          ) : null}
        </div>

        <button
          type={onNext ? "button" : "submit"}
          onClick={onNext}
          disabled={loading || nextDisabled}
          title={nextTitle}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
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
  const t = useT();
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-green-500/10 border border-green-500/25 text-sm">
      <Check className="h-4 w-4 text-green-400 shrink-0" />
      <span className="font-medium flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground truncate max-w-40">{sub}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        aria-label={t("setup.remove")}
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

function InfoModal({
  title,
  text,
  onClose,
}: {
  title: string;
  text: string;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("common.close")}
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
            {t("setup.gotIt")}
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
