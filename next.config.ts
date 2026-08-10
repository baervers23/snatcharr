import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  output: "standalone",
  // Stop dev HMR loops from data/ writes (SQLite, logs, config) and Windows ADS files.
  webpack: (config, { dev }) => {
    if (dev) {
      // Webpack requires ignored to be all glob strings OR a single RegExp — not mixed.
      Object.defineProperty(config, "watchOptions", {
        ...Object.getOwnPropertyDescriptor(config, "watchOptions"),
        value: {
          ...config.watchOptions,
          ignored: [
            "**/node_modules/**",
            "**/.git/**",
            "**/.next/**",
            "**/data/**",
            "**/*.db",
            "**/*.db-wal",
            "**/*.db-shm",
            "**/*.log",
            "**/*Zone.Identifier",
          ],
        },
      });
    }
    return config;
  },
};

export default nextConfig;
