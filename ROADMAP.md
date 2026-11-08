# Project Roadmap: Cloud-Native PaaS (Mini-Render / Railway)
## (v3.0 - Serverless-First MVP Strategy)

A developer platform that automates deploying containerized backend applications with scale-to-zero economics, real-time telemetry, and pluggable runtime drivers.

---

## 🎯 Strategic Approach: MVP First ($0 Cost), Advanced Drivers Later

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: THE WORKING SERVERLESS MVP (COST: ₹0 / $0) - IN PROGRESS NOW       │
│ - Offload builds to Google Cloud Build (Free 120 mins/day)                  │
│ - Deploy to Google Cloud Run with scale-to-zero (Free 2M reqs/month)        │
│ - Zero laptop heat, zero server bills, instant working public HTTPS URLs    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: ADVANCED EXPANSION (LATER ROADMAP MILESTONES)                      │
│ - Custom Knative-style "Activator" (In-memory HTTP request buffering)       │
│ - Kubernetes Driver (Dynamic Pods/Deployments for enterprise BYOC)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Phases & Milestones

### Phase 0: Monorepo Foundation & Tooling Setup
- [x] Initialize `bun` workspaces monorepo structure.
- [x] Configure root `tsconfig.base.json`, Biome linter/formatter, and Husky pre-commit hooks.
- [x] Set up `@deployment/shared` for shared TypeScript types and Zod schemas.
- [x] Set up `@deployment/db` with Prisma ORM and Neon/Supabase PostgreSQL schema.
- [x] Create project verification harness (`doctor.ts` and `.agents/skills/verify-deployment-system/`).
- [x] Push initial codebase to GitHub.

---

### Phase 1: The Core Serverless Engine (`services/orchestrator`) *(CURRENT)*
**Goal:** A working pipeline that clones a repo, compiles it on Google Cloud Build, and deploys to Google Cloud Run with scale-to-zero.
- [x] **Git Cloner (`cloner.ts`):** Shallow clones repo and extracts commit SHA.
- [ ] **GCS Source Uploader (`gcp-storage.ts`):** Bundles source into `.tar.gz` and streams to Google Cloud Storage.
- [ ] **Cloud Build Compiler (`gcp-builder.ts`):** Triggers Google Cloud Build via `@google-cloud/cloudbuild` and tags image in Google Artifact Registry.
- [ ] **Cloud Run Deployer (`gcp-runner.ts`):** Deploys service via `@google-cloud/run` with `--min-instances 0` (scale-to-zero) and returns live HTTPS URL.
- [ ] **End-to-End Test:** Deploy a real sample Express/FastAPI repo to a live Cloud Run URL.

---

### Phase 2: Control Plane API & Database Integration (`services/control-api`)
**Goal:** REST API managing projects, environment variables, and deployment state machine.
- [ ] Connect Fastify to `@deployment/db` (Neon / Supabase).
- [ ] REST Endpoints:
  - `POST /api/projects` - Create project
  - `GET /api/projects` - List projects with active status
  - `POST /api/projects/:id/deploy` - Trigger asynchronous deployment
  - `GET /api/deployments/:id` - Poll deployment status
- [ ] Deployment State Machine: `QUEUED` → `BUILDING` → `PROVISIONING` → `ACTIVE` → `SLEEPING`.

---

### Phase 3: Real-Time Telemetry & Web Dashboard (`services/web-dashboard`)
**Goal:** Sleek Vercel/Railway-style dark-mode interface with live terminal logs.
- [ ] Stream Cloud Build & Cloud Run logs in real time via Server-Sent Events (SSE).
- [ ] Embed `@xterm/xterm` terminal component subscribed to live build logs.
- [ ] Dashboard views: Project overview, live status badge (`ACTIVE` 🟢 / `SLEEPING` 💤), env var manager, and live app link.

---

### 🚀 ADVANCED MILESTONES (Planned for After MVP)

### Phase 4: The Custom Activator & Reverse Proxy (`services/reverse-proxy`)
**Goal:** Implement the Knative Activator pattern for custom wildcard domain routing.
- [ ] In-memory dynamic route registry (`Map<slug, targetUrl>`).
- [ ] Subdomain parser: maps `*.platform.domain` → container destination.
- [ ] **The Activator Request Buffer:** Holds incoming HTTP socket connections in memory during cold starts until the container responds, preventing 502 Bad Gateway timeouts.
- [ ] Splash screen: streams a sleek *"Waking up server..."* loader if cold start takes >1s.

---

### Phase 5: The Kubernetes (K8s) Driver (`services/orchestrator/src/drivers/k8s`)
**Goal:** Support deploying into managed Kubernetes clusters for enterprise BYOC users.
- [ ] Implement `KubernetesDriver` using `@kubernetes/client-node`.
- [ ] Programmatically generate K8s Pods, Deployments, and ClusterIP Services.
- [ ] Configurable runtime selection per project:
  ```json
  { "runtime": "cloud-run" | "kubernetes" | "custom" }
  ```
- [ ] Helm chart and K8s manifests for single-command cluster installation.

---

## 💰 Cost Architecture Overview

| Phase | Service | Cost |
| :--- | :--- | :--- |
| **MVP (Phases 1-3)** | Cloud Run (`min-instances: 0`) + Cloud Build + GCS | **₹0.00 / $0.00** (Free tiers & monthly ₹960 credit) |
| **Advanced (Phase 4)** | Custom Activator / Reverse Proxy | **₹0.00** (Runs on Cloud Run / Cloudflare Edge) |
| **Advanced (Phase 5)** | Kubernetes Driver (K8s) | **Optional** (Only spun up on-demand, not running 24/7) |
