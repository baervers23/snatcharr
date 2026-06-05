# Snatcharr

A modern, self-hosted Usenet search & download manager with a dark \*arr-style UI.  
Built with Next.js 15, TypeScript, TailwindCSS, Drizzle ORM, and Auth.js.

---

## Features

- **Setup Wizard** — guided first-run setup (admin account, Prowlarr, SABnzbd, apps)
- **Search** — multi-indexer search via Prowlarr with category filters, result preview, one-click grab
- **Grabs** — live download progress, file browser, time-limited download links
- **Stats** — per-user and admin-wide download statistics and rankings
- **Settings** — General, Security, Indexers, Download Clients, Apps
- **Users** — admin user management with per-user limits
- **System** — health checks, live logs, disk/memory info
- **Dark UI** — \*arr-inspired dark theme, fully responsive
- **Docker ready** — single `docker compose up` deployment

---

## Quick Start

### Development

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env.local
# Edit .env.local — at minimum set NEXTAUTH_SECRET

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the Setup Wizard will launch automatically.

### Docker (Production)

```bash
# 1. Copy environment
cp .env.example .env

# 2. Edit .env — set NEXTAUTH_SECRET and NEXTAUTH_URL

# 3. Build and start
docker compose up -d

# With Redis:
docker compose --profile full up -d
```

### Environment Variables

| Variable            | Required | Default                    | Description                            |
| ------------------- | -------- | -------------------------- | -------------------------------------- |
| `NEXTAUTH_SECRET`   | **Yes**  | —                          | Random 32+ char secret for JWT signing |
| `NEXTAUTH_URL`      | **Yes**  | `http://localhost:3000`    | Public URL of the app                  |
| `DATABASE_URL`      | No       | `file:./data/snatcharr.db` | SQLite path or PostgreSQL URL          |
| `DATA_DIR_HOST`     | No       | `./data`                   | Directory for DB and app data          |
| `DOWNLOAD_DIR_HOST` | No       | `./downloads`              | Where downloaded files are stored      |
| `REDIS_URL`         | No       | —                          | Redis URL for rate limiting            |
| `SMTP_*`            | No       | —                          | Email settings for notifications       |

---

## Architecture

```
snatcharr/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated app pages
│   │   ├── search/         # Search tab
│   │   ├── grabs/          # Downloads tab
│   │   ├── stats/          # Statistics
│   │   ├── settings/       # Settings (admin)
│   │   ├── users/          # User management (admin)
│   │   ├── system/         # System health (admin)
│   │   └── profile/        # User profile
│   ├── api/                # API routes
│   ├── login/              # Login page
│   └── setup/              # First-run wizard
├── components/             # React components
├── lib/
│   ├── db/                 # Drizzle ORM + schema + settings
│   ├── prowlarr.ts         # Prowlarr API client
│   ├── sabnzbd.ts          # SABnzbd API client
│   └── rate-limit.ts       # Rate limiting
├── auth.ts                 # NextAuth.js config
├── middleware.ts            # Auth middleware
├── Dockerfile
└── docker-compose.yml
```

---

## Integrations

| Service      | Purpose                                |
| ------------ | -------------------------------------- |
| **Prowlarr** | NZB indexer aggregator — search source |
| **SABnzbd**  | Primary download client                |
| **NZBGet**   | Alternative download client            |
| **Jellyfin** | User authentication + media sync       |
| **Seerr**    | Media request integration              |
| **Organizr** | Single-pane SSO authentication         |

---

## Security Notes

- NZB download URLs are **never exposed** to the browser — all grabs happen server-side
- API keys are masked in UI for non-admin users
- Log output automatically redacts long token-like strings
- Rate limiting applied to search and login endpoints
- All passwords hashed with bcrypt (cost factor 12)

---

## License

MIT
