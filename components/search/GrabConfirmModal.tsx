"use client";

import { useState, useEffect } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import type { ProwlarrSearchResult } from "@/lib/prowlarr";

interface DownloadClient {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

interface Props {
  result: ProwlarrSearchResult;
  onClose: () => void;
  onConfirm: (clientId: string) => void;
}

export default function GrabConfirmModal({ result, onClose, onConfirm }: Props) {
  const [clients, setClients] = useState<DownloadClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    fetch("/api/download-clients")
      .then((r) => r.json())
      .then((data: { clients?: DownloadClient[] }) => {
        const active = (data.clients ?? []).filter((c) => c.enabled);
        setClients(active);
        if (active.length > 0) setSelectedClient(active[0].id);
      })
      .catch(console.error)
      .finally(() => setLoadingClients(false));
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-md animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Download className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Confirm Grab</h3>
          <button
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="nv-card p-3 bg-muted/30">
            <p className="text-sm font-medium text-foreground line-clamp-2">{result.title}</p>
            {result.size && (
              <p className="text-xs text-muted-foreground mt-1">{formatBytes(result.size)}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="nv-label">Send to Download Client</label>
            {loadingClients ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading clients...
              </div>
            ) : clients.length === 0 ? (
              <p className="text-sm text-destructive">
                No download clients configured. Add one in Settings → Download Clients.
              </p>
            ) : (
              <select
                className="nv-input w-full"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedClient && onConfirm(selectedClient)}
            disabled={!selectedClient || clients.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Grab
          </button>
        </div>
      </div>
    </div>
  );
}
