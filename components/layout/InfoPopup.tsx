"use client";

import { X, Info } from "lucide-react";

interface InfoPopupProps {
  text: string;
  onClose: () => void;
}

export default function InfoPopup({ text, onClose }: InfoPopupProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md animate-slide-in">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Info className="h-5 w-5 text-primary shrink-0" />
          <h3 className="font-semibold text-foreground">Notice</h3>
          <button
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
