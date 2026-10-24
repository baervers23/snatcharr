import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary } from "@/lib/i18n/server";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Snatcharr",
  description: "Usenet grab manager",
  icons: { icon: "/favicon.ico" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dictionary } = await getDictionary();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-screen font-sans antialiased`}>
        <I18nProvider locale={locale} dictionary={dictionary}>
          {children}
        </I18nProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "bg-card border border-border text-foreground shadow-lg",
              title: "text-foreground",
              description: "text-muted-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
