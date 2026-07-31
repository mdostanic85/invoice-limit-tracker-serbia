# LimitRadar

A desktop-first SaaS workspace for Serbian entrepreneurs and small agencies who need to track issued invoices, monitor annual revenue against a configurable RSD threshold, and plan future billing with confidence.

**Live demo:** https://limitradar.vercel.app

**Repository:** https://github.com/mdostanic85/invoice-limit-tracker-serbia

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)

---

## The problem I wanted to solve

As a freelancer working with Serbian and international clients, I kept running into the same question: *how close am I to the annual revenue threshold (paušal / independent activity limits)?* Spreadsheets worked until they didn't — exchange rates changed, invoices were in EUR, some clients were hourly, others fixed, and I needed **projections**, not just history.

This app is not full accounting software. It is a focused **invoice-revenue tracker**, **limit monitor**, and **forecasting workspace** built around the official NBS middle exchange rate.

---

## What I built

### Core features

| Area | What it does |
|------|----------------|
| **Dashboard** | YTD invoiced total in RSD, limit usage bar, monthly charts, client breakdown |
| **Invoices** | CRUD with immutable NBS rate snapshots, status workflow, duplicate & export |
| **Clients** | Fixed or hourly billing, hourly rate history, archive/restore |
| **Forecast** | Three scenarios (Conservative / Expected / Optimistic), monthly planning grid |
| **Saved forecast plans** | Save, view, load, and delete named forecast snapshots per year |
| **Annual plan** | Year-end projection and limit crossing month |
| **Reports** | CSV / Excel export |
| **Audit log** | Full change history for invoices, rates, forecasts, clients |
| **PDF import (AI)** | Upload invoice PDF → AI extraction → review → save with NBS conversion |
| **i18n** | English + Serbian (Latin) UI |

### Serbia-specific logic

- **NBS middle rate** integration with cache, fallback, and manual override
- Revenue counted by **issue date** or **payment date** (configurable)
- Default annual threshold: **6,000,000 RSD** (editable)
- **Weekday-only** billable days for hourly client auto-forecast (Mon–Fri, 8h/day)
- Cron prefetch of exchange rates on **weekdays only** (`0 7 * * 1-5`)

### UX details I cared about

- Threshold progress bar: **green** → **orange near 90%** → **red only when exceeded**
- Live forecast projections while editing the monthly grid
- Bento-style dashboard layout, Ant Design 6 components
- Desktop-first density with responsive drawers on mobile

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 16** (App Router) | Server Components, Server Actions, Vercel-native |
| Language | **TypeScript** | End-to-end type safety |
| UI | **Ant Design 6** + custom layout primitives | Fast, accessible enterprise UI |
| Charts | **Ant Design Charts** + Recharts | Dashboard & annual plan visualizations |
| Auth | **Clerk** | Auth + org-ready, minimal setup |
| Database | **PostgreSQL** + **Prisma 7** | Relational model, `Decimal` for money |
| Money math | **decimal.js** | No floating-point bugs |
| Validation | **Zod** | Shared client/server schemas |
| AI | **Vercel AI SDK** (Gemini / OpenAI) | PDF invoice extraction |
| Storage | **Vercel Blob** | Invoice PDF attachments |
| Deploy | **Vercel** | Cron, serverless, preview URLs |
| Tests | **Vitest** | Domain logic (limits, NBS parser, Stilt forecast) |

---

## Architecture (high level)

```
┌─────────────┐     Server Actions      ┌──────────────────┐
│  React UI   │ ───────────────────────▶│  Service layer   │
│  (Ant Design)│                        │  invoice, limit, │
└─────────────┘                         │  forecast, audit │
       │                                └────────┬─────────┘
       │                                         │
       ▼                                         ▼
┌─────────────┐                         ┌──────────────────┐
│  Clerk auth │                         │  PostgreSQL      │
│  middleware │                         │  (Prisma)        │
└─────────────┘                         └──────────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    ▼                           ▼                           ▼
             NBS rate provider           Exchange rate cache            Vercel Blob
             (scrape + fallback)        (cron prefetch)                (PDFs)
```

**Domain modules** live under `lib/domain/` (limit calculations, Stilt monthly forecast, forecast snapshots).  
**Server Actions** under `app/actions/` — no separate REST API for most mutations.  
**Multi-tenant ready:** every table scoped by `organizationId`.

---

## How I built it (process & AI workflow)

This project was built as a **real product experiment**, not a tutorial clone. I used AI as a **pair engineer and reviewer**, not as a copy-paste machine.

### 1. Product & technical planning

I started with a structured product brief: problem statement, user personas (Serbian freelancer / micro agency), reporting basis, NBS rate rules, forecast scenarios, and audit requirements. I asked the AI to produce an implementation plan first — schema, routes, risks — **before** writing production code.

### 2. Iterative vertical slices

I shipped in layers:

1. Auth + onboarding + org settings  
2. Clients & invoices with NBS rate snapshot on create  
3. Dashboard limit status & monthly grouping  
4. Forecast grid + three scenarios  
5. Hourly billing (days not hours, weekday-only for auto-forecast)  
6. Serbian localization  
7. PDF import with human-in-the-loop AI extraction  
8. Saved forecast snapshots  
9. UI polish pass  

Each slice was **end-to-end** (DB → action → UI) before moving on.

### 3. How I used AI (Cursor + Claude)

| Task | How AI helped | What I kept human |
|------|----------------|-------------------|
| Schema design | Drafted Prisma models, indexes, enums | Final money fields, audit actions, tenant scoping |
| NBS integration | Parser scaffolding, cache strategy | Verified against real NBS HTML, fallback rules |
| Server Actions | CRUD boilerplate, Zod schemas | Business rules (eligibility, limit blocking) |
| Forecast logic | Stilt auto-forecast, snapshot save/load | Weekday-only billing rule, editable-month rules |
| UI components | Ant Design table/forms, bento layout | Information hierarchy, Serbian copy tone |
| Debugging | Prisma client cache issues, hydration fixes | Root-cause validation, deploy config |
| Tests | Vitest cases for limit math | Edge cases (threshold states, month boundaries) |

**Principles I followed:**

- Read every diff — never merge what I don't understand  
- Keep domain logic in pure functions (`lib/domain/`) for testability  
- Minimize scope per change; reject over-engineering  
- Use AI for speed on boilerplate, not for architecture decisions  

### 4. Design & UI polish (Figma Canvas)

After the functional MVP worked, I ran a **UI polish pass**:

- Used **Figma Canvas** (via Cursor's canvas workflow) to explore dashboard density, card hierarchy, and forecast grid spacing side-by-side with the running app  
- Adjusted progress bar semantics (orange = near limit, red = exceeded only)  
- Tightened forecast page: removed redundant invoice list, elevated saved-plan workflow  
- Aligned Ant Design tokens (tags, stat blocks, drawer footers) for a consistent SaaS feel  

The canvas was especially useful for comparing **three forecast scenario cards** and the **monthly plan table** without redeploying — layout decisions first, code second.

---

## Local development

### Prerequisites

- Node.js 20+  
- Docker (for local Postgres)  
- Clerk account  
- (Optional) Gemini or OpenAI key for PDF import  

### Setup

```bash
git clone https://github.com/mdostanic85/invoice-limit-tracker-serbia.git
cd invoice-limit-tracker-serbia

cp .env.example .env.local
# Fill in DATABASE_URL, Clerk keys, CRON_SECRET

docker compose up -d

npm install
npx prisma db push

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npx vitest run
```

---

## Deployment (Vercel)

1. Push this repo to GitHub  
2. Import project in [Vercel](https://vercel.com/new)  
3. Add environment variables from `.env.example`  
4. Use **Vercel Postgres** or **Neon** for `DATABASE_URL`  
5. Run `npx prisma db push` against production DB (or add a migrate step in CI)  
6. Configure Clerk production URLs + webhook (`/api/webhooks/clerk`)  
7. Cron job is defined in `vercel.json` (weekday rate prefetch)

---

## Project structure

```
app/
  (app)/          # Authenticated routes (dashboard, invoices, forecast, …)
  (auth)/         # Clerk sign-in / sign-up
  actions/        # Server Actions
  api/            # Cron, webhooks, export
components/
  domain/         # InvoiceStatusTag, AnnualLimitProgress, ForecastSnapshots, …
  layout/         # PageContent, BentoGrid, AppDrawer, …
lib/
  domain/         # Pure business logic (limits, forecasts, NBS rules)
  exchange-rate/  # NBS provider + cache
  services/       # Invoice, audit, sync-stilt-forecast, …
  i18n/           # EN + SR message trees
prisma/
  schema.prisma   # Single source of truth for data model
```

---

## What this demonstrates

- **Full-stack product thinking** — from Serbian tax context to UX, not just CRUD  
- **Correct money handling** — Decimal in DB, decimal.js in app, immutable rate snapshots  
- **AI-assisted development** — fast iteration with human review and domain ownership  
- **Design-aware engineering** — Figma Canvas for polish, Ant Design for consistency  
- **Production habits** — audit log, cron, i18n, env templates, multi-tenant schema  

---

## License

LimitRadar is available under the [MIT License](LICENSE). See
[OWNERSHIP.md](OWNERSHIP.md) for project ownership and brand information.

---

Built and maintained by [**Miloš Dostanić**](https://github.com/mdostanic85) · Belgrade, Serbia
