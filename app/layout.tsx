import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Snatcharr",
  description: "Usenet search & download manager",
  icons: { icon: "/favicon.ico" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <SessionProvider session={session}>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "bg-card border border-border text-foreground",
                title: "text-foreground",
                description: "text-muted-foreground",
                success: "border-green-500/30",
                error: "border-red-500/30",
                warning: "border-yellow-500/30",
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
