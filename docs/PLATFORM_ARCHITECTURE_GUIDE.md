# Mini-Render / Railway / Vercel Platform: Comprehensive Architectural Guide
## System Design, Industry Patterns, Caching, Next.js, and Cloud Infrastructure

---

## 1. Executive Vision & Core Mission

This platform is a cloud-native, serverless **Platform as a Service (PaaS)** built to deploy both:
1. **Frontend Static Sites** (React, Vite, Astro, Vue, Next.js static export).
2. **Backend Web Services & APIs** (Express.js, FastAPI, Python, Go, NestJS, Dockerfiles, and Fullstack Next.js SSR).

### Key Architectural Tenets:
* **Zero Laptop CPU Usage:** Builds happen in the cloud via Google Cloud Build; local machines stay cold and quiet.
* **Scale-to-Zero Economics:** Idle apps consume 0 vCPU and 0 RAM, yielding **$0.00 / month** hosting costs for inactive projects.
* **Cost Neutrality:** Leverages Google Cloud's permanent Free Tiers combined with recurring **Google Developer Program credits** (~₹960 / $11.50 USD/mo).
* **Pluggable Driver Pattern:** A single configuration switch (`RUNTIME_DRIVER="gcp"` vs `"local"`) toggles between Google Cloud and local offline Docker orchestration with zero code rewrites.

---

## 2. Industry Landscape & Architectural Comparison

### How the Community Builds Vercel / Railway Clones:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MODEL 1: The "Single-Server" Model (Coolify, Dokku, CapRover)          │
│ - Uses a single Linux VPS (e.g., $5 Hetzner or DigitalOcean).          │
│ - Runs `docker build` using Nixpacks directly on that server.          │
│ - Reverse proxy (Traefik/Caddy) routes requests on ports 80/443.       │
│                                                                        │
│ ⚠️ Bottleneck: A single server runs out of RAM after 5-10 apps.        │
│ No native scale-to-zero. Expensive to scale horizontally.              │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MODEL 2: The "Static-Only S3" Model (Harkirat 100xDevs, Krish, Sankalp)│
│ - Builds static bundles via AWS ECS Fargate / Lambda.                  │
│ - Uploads compiled `dist/` or `build/` files to Amazon S3.             │
│ - Reverse proxy or CloudFront fetches files from S3 and serves them.   │
│                                                                        │
│ ⚠️ Bottleneck: CANNOT run backend servers (Express, Python, FastAPI)   │
│ or dynamic Next.js SSR. S3 cannot execute a running Node/Python server.│
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MODEL 3: Our "Dual-Workload Serverless" Model (Railway/Render Hybrid)   │
│ - Frontends: Uploaded to Google Cloud Storage + fast reverse proxy.    │
│ - Backends: Deployed to Google Cloud Run with `--min-instances 0`.     │
│ - Builds: Google Cloud Build (120 free mins/day on Google's cloud).    │
│                                                                        │
│ 🏆 Advantages: True scale-to-zero, runs ANY backend or frontend,       │
│ zero server CPU load, free automatic HTTPS, $0 dormant cost.           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dual-Workload Support (Frontends vs. Backends)

```
                       [ Developer Git Repository ]
                                    │
                    What type of application is it?
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────────────┐         ┌───────────────────────────────┐
│ 1. STATIC FRONTEND SITE       │         │ 2. BACKEND / SSR WEB SERVICE  │
│ (Vite, React, Astro, Static)  │         │ (Express, FastAPI, Python, Go,│
│                               │         │  Next.js Standalone SSR)      │
├───────────────────────────────┤         ├───────────────────────────────┤
│ • Build: Compiles `dist/`     │         │ • Build: Compiles OCI image   │
│ • Storage: Pushed to GCS      │         │ • Registry: Artifact Registry │
│ • Serving: Reverse Proxy      │         │ • Runtime: Google Cloud Run   │
│ • Routing: SPA 404 fallback   │         │ • Scale: `--min-instances: 0` │
│ • Cost: Fractions of a cent   │         │ • Cost: Free within 2M reqs   │
└───────────────────────────────┘         └───────────────────────────────┘
```

---

## 4. Next.js Support: Static vs. Dynamic (SSR)

### Why S3-only clones fail with Next.js:
Static Vercel clones break on Next.js because modern Next.js uses:
* Server-Side Rendering (SSR)
* Server Actions (`'use server'`)
* API routes (`/api/...`)
* React Server Components (RSC)

### How our platform runs Next.js natively:
Next.js provides an official **Standalone Mode**:
```javascript
// next.config.js
module.exports = {
  output: 'standalone',
};
```
* Building with `output: 'standalone'` creates a self-contained, minimal Node.js server (`server.js`) consuming only **~50MB of RAM**.
* Our platform packages this into a container and deploys it to **Google Cloud Run**.
* **Result:** Full dynamic Next.js with Server Actions and API routes running with **sub-second cold starts** and scaling to zero when idle!

---

## 5. Edge Caching & CDN Strategy

To achieve sub-10ms page loads worldwide, our platform employs a 3-tier caching hierarchy:

```
[ User in Tokyo / London ]
            │
            ▼
┌───────────────────────────────────────┐
│ Tier 1: Cloudflare Global Edge CDN    │ ──► Serves cached static files in <10ms
└───────────────────┬───────────────────┘
                    │ Cache Miss
                    ▼
┌───────────────────────────────────────┐
│ Tier 2: Reverse Proxy HTTP Headers    │
│ • Hashed assets (.js, .css):          │
│   Cache-Control: public, max-age=31536000, immutable
│ • HTML (index.html):                  │
│   Cache-Control: public, max-age=0, must-revalidate
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ Tier 3: Next.js In-Memory ISR Cache   │ ──► Caches pre-rendered pages in RAM
└───────────────────────────────────────┘
```

---

## 6. Real-Time Telemetry & Log Streaming

Instead of naive polling (`setInterval` every 2 seconds):
1. **Cloud Build Events:** Cloud Build publishes state transitions (`QUEUED` → `WORKING` → `SUCCESS` / `FAILURE`) to a **Google Cloud Pub/Sub** topic.
2. **Container Output:** Cloud Logging captures `stdout` and `stderr` streams directly from the build process.
3. **Broadcasting:** The Fastify Control API consumes the log stream and pushes it to the browser via **Server-Sent Events (SSE)**.
4. **Terminal Rendering:** The frontend dashboard hooks the SSE stream into `@xterm/xterm` to render colored ANSI terminal logs with auto-scrolling.

---

## 7. Pluggable Driver Architecture (Local vs. GCP)

The platform is decoupled from any single container runtime using the **Driver Pattern**:

```typescript
export interface DeploymentDriver {
  build(options: BuildRequest): Promise<BuildResult>;
  deploy(options: DeployRequest): Promise<DeployResult>;
  getLogs(deploymentId: string): Promise<string[]>;
}
```

* **`GcpDriver` (Current Cloud Target):**
  * Build: Google Cloud Build (remote compiling).
  * Storage: Google Cloud Storage (`paas-platform-12345-source-bucket`).
  * Registry: Google Artifact Registry (`paas-platform-12345-apps`).
  * Compute: Google Cloud Run (`--min-instances 0`).
* **`LocalDriver` (Offline Fallback):**
  * Build: Local Git Cloner (`cloner.ts`) + Local Docker daemon.
  * Compute: Local Docker bridge network (`paas-internal-network`).
  * Proxy: Local reverse proxy (`*.localhost:8000`).

**Switching environments requires changing 1 variable in `.env`:**
```env
RUNTIME_DRIVER="gcp"    # Uses Google Cloud Run & Cloud Build
# RUNTIME_DRIVER="local"  # Uses local Docker on your laptop
```

---

## 8. Monthly Economics & Free Tier Budget

| GCP Service | Monthly Free Tier Allowance | Purpose in Platform | Cost for Dev/Testing |
| :--- | :--- | :--- | :--- |
| **Cloud Run Services** | 2 Million requests + 360k vCPU-sec | Serverless app container hosting | **$0.00** |
| **Cloud Build** | 120 build-minutes / day (~3,600 min/mo) | Remote container compiling | **$0.00** |
| **Cloud Storage (GCS)** | 5 GB storage | Source zips & static site assets | **$0.00** |
| **Artifact Registry** | 0.5 GB storage ($0.10/GB beyond) | Docker image storage | **~$0.10 – $0.50** |
| **Cloud Logging** | 50 GB log volume | Real-time container telemetry | **$0.00** |
| **Cloud Pub/Sub** | 10 GB message throughput | Real-time build event notifications | **$0.00** |
| **Neon / Supabase** | Free tier serverless PostgreSQL | Control plane project metadata | **$0.00** |
| **Monthly Credit** | **₹959.89 / month** recurring credit | Covers all stray usage | **₹0.00 Net Cost** |

---

## 9. Current Codebase Milestones (Completed)

* [x] **Phase 0:** Monorepo scaffolding with Bun workspaces, Biome linter/formatter, and Husky pre-commit hooks.
* [x] **Database:** `@deployment/db` configured with Prisma schema (`Project`, `Deployment`, `EnvironmentVariable` models).
* [x] **Contracts:** `@deployment/shared` configured with Zod validation schemas and type-safe environment parser.
* [x] **Git Cloner:** `cloner.ts` written and verified with shallow git cloning and commit hash extraction.
* [x] **Cloud Infrastructure (IaC):** Terraform configuration in `infra/terraform/` provisioned:
  * Google Cloud Storage: `paas-platform-12345-source-bucket`
  * Google Artifact Registry: `us-central1-docker.pkg.dev/paas-platform-12345/paas-platform-12345-apps`
  * Service Account: `paas-engine@paas-platform-12345.iam.gserviceaccount.com`
  * 4 APIs enabled: `cloudbuild`, `run`, `artifactregistry`, `storage`.
* [x] **Diagnostics:** `bun run doctor` verified healthy against Google Cloud.
* [x] **Version Control:** All code committed and pushed to GitHub: [github.com/Izume01/deployment-system](https://github.com/Izume01/deployment-system).
