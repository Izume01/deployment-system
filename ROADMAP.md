# Project Roadmap: Mini-Render / Railway Deployment Platform
## (v2.0 - With Redis, Observability, Terraform & Kubernetes)

A self-hosted, cloud-ready Platform as a Service (PaaS) to deploy, run, and manage backend applications with asynchronous build queues, dynamic reverse proxying, zero-downtime rolling deploys, live metrics, and multi-runtime orchestration.

---

## Architecture Topology

```
[ Developer Browser / Public Traffic ]
        │
        ├──► Web Dashboard (:3000) ──────► Control Plane API (:4000)
        │    (Next.js + xterm + charts)                │
        │                                              ├──► [ Neon/Supabase DB ]
        │                                              │
        │                                              └──► [ Redis: BullMQ Queue & Pub/Sub ]
        │                                                               ▲
        │                                                               │
        │                                               Orchestrator Worker (:5000)
        │                                                               │
        │                                              ┌────────────────┴────────────────┐
        │                                              ▼                                 ▼
        │                                    [ Docker Engine Driver ]          [ Kubernetes Driver ]
        │                                       (Local Machine)                   (GKE / Cloud)
        │                                              │
        │                                              ▼
        └────► Reverse Proxy (:8000) ────────► [ Running App Containers ]
               - Dynamic Routing                       │
               - Prometheus /metrics                   ▼
                                             [ Real-time CPU/RAM Telemetry ]
```

---

## 🗺️ Phases & Milestones

### Phase 0: Monorepo Foundation & Tooling Setup
- [ ] Initialize `pnpm` workspaces monorepo structure.
- [ ] Configure root `tsconfig.json`, ESLint, and Prettier.
- [ ] Create `packages/shared` for shared TypeScript interfaces, Zod schemas, and status enums.
- [ ] Establish project verification harness (`.agents/skills/verify-deployment-system/`) with health checks.
- [ ] Set up Docker internal bridge network (`paas-internal-network`).
- [ ] Add Docker Compose file for local dependencies (Redis + local dev services).

---

### Phase 1: Container Orchestration Engine & Runtime Driver (`services/orchestrator`)
**Goal:** Abstracted container controller that builds images and executes containers with cgroups isolation.
- [ ] Define the `ContainerRuntimeDriver` interface (build, run, health, stats, logs, stop).
- [ ] Implement `DockerDriver` via Docker Engine API (`dockerode`).
- [ ] Implement Git cloner (clones into ephemeral workspace, extracts commit SHA).
- [ ] Implement Smart Builder:
  - If repo contains `Dockerfile` → build using user's Dockerfile.
  - If repo is Node.js (`package.json`) without Dockerfile → generate standard multi-stage build.
- [ ] Implement Container Runner with cgroup constraints:
  - RAM ceiling: 512 MB (`Memory: 536870912`).
  - CPU quota: 1.0 vCPU (`NanoCPUs: 1000000000`).
  - Pids limit: 100 (fork bomb prevention).
- [ ] Connect containers to `paas-internal-network` with injected environment variables.
- [ ] Integration test: Build and launch a sample backend container programmatically.

---

### Phase 2: Dynamic Reverse Proxy & Edge Routing (`services/reverse-proxy`)
**Goal:** Intercept incoming traffic on `*.localhost:8000` and dynamically forward HTTP/WebSocket requests to the active container.
- [ ] Create high-performance reverse proxy server using Fastify / `http-proxy`.
- [ ] Implement thread-safe in-memory Route Registry:
  - Maps `projectSlug` → `http://<container-ip>:<internal-port>`.
- [ ] Subdomain parser: Extract slug from `Host` header (`my-app.localhost:8000` → `my-app`).
- [ ] Implement fallback routing:
  - `503 Service Unavailable` with clean HTML page if container is starting or crashed.
  - `404 Not Found` if project slug does not exist.
- [ ] Internal route management API (`POST /routes`, `DELETE /routes/:slug`).
- [ ] Add Prometheus metrics endpoint (`GET /metrics` for request count, latency percentiles, error rates).

---

### Phase 3: Zero-Downtime Deployments & Health Checks
**Goal:** Seamlessly deploy new versions without dropping a single user request.
- [ ] Implement Health Check Polling engine:
  - Ping container internal port (`GET /` or `GET /health` or TCP connect) after boot.
  - Configurable timeout (default: 60s) and exponential backoff retry.
- [ ] Implement Blue-Green Route Swap:
  - Only update reverse proxy route *after* new container returns `200 OK`.
- [ ] Implement Graceful Old Container Teardown:
  - Send `SIGTERM` to previous container version.
  - Wait 10-second grace period for in-flight requests to complete.
  - Issue `SIGKILL` if process has not exited.

---

### Phase 4: Redis Asynchronous Queue & Real-time Telemetry
**Goal:** Queue builds asynchronously via BullMQ and stream live logs/metrics over Redis Pub/Sub.
- [ ] Connect Redis client for queue and pub/sub.
- [ ] Implement BullMQ Build Queue:
  - API pushes build jobs; Worker executes builds with configurable concurrency (e.g. 2 parallel).
- [ ] Docker socket stream demultiplexer:
  - Separate stdout (`0x01` header) and stderr (`0x02` header).
  - Publish log lines to Redis channel: `deployments:<id>:logs`.
- [ ] Implement Container Metrics Collector:
  - Polls Docker stats every 3s (CPU %, Memory MB, Network I/O).
  - Publishes stats to Redis channel: `projects:<id>:metrics`.
- [ ] Server-Sent Events (SSE) endpoints:
  - `GET /api/deployments/:id/logs/stream` (Live terminal output)
  - `GET /api/projects/:id/metrics/stream` (Live CPU/RAM metrics)

---

### Phase 5: Control Plane API & Database (`services/control-api`)
**Goal:** Persistent management layer backed by Neon / Supabase PostgreSQL.
- [ ] Set up Prisma ORM connected to Neon / Supabase.
- [ ] Define relational data models:
  - `Project` (id, name, slug, repoUrl, branch, targetPort, createdAt)
  - `Deployment` (id, projectId, commitHash, status, containerId, startedAt, completedAt)
  - `EnvironmentVariable` (id, projectId, key, value, isSecret)
  - `MetricSnapshot` (id, projectId, cpuPercent, memoryMb, recordedAt)
- [ ] Implement REST endpoints:
  - `POST /api/projects` - Create project
  - `GET /api/projects` - List all projects
  - `GET /api/projects/:id` - Get project details & deployments
  - `POST /api/projects/:id/deploy` - Trigger an async deployment job
  - `POST /api/projects/:id/rollback/:deploymentId` - Instant rollback to previous deployment
  - `POST /api/projects/:id/env` - Manage environment variables
- [ ] Deployment State Machine:
  - `QUEUED` → `BUILDING` → `STARTING` → `HEALTHY` → `RUNNING` / `FAILED`.

---

### Phase 6: Client-Facing Web Dashboard (`services/web-dashboard`)
**Goal:** Polished, responsive Vercel/Railway-style dark mode web interface.
- [ ] Scaffold Next.js 14+ (App Router) with Tailwind CSS & shadcn/ui.
- [ ] **Projects Overview Page:**
  - Displays all hosted apps, live status badges (Running, Deploying, Failed), and quick links.
- [ ] **New Project Modal:**
  - Input Git repo URL, branch name, custom slug, internal port, and initial env vars.
- [ ] **Project Details & Deployment Page:**
  - Header with live URL (`http://<slug>.localhost:8000`).
  - Interactive `@xterm/xterm` terminal component subscribed to live SSE log stream.
  - Live charts for CPU & Memory utilization.
  - Deployment history table with one-click "Rollback" button.
- [ ] **Environment Variables Settings Page:**
  - Key-value editor with masked secret values and redeploy trigger.

---

### Phase 7: Infrastructure as Code (Terraform) & Kubernetes (K8s) Driver
**Goal:** Cloud infrastructure automation and enterprise container orchestration.
- [ ] **Terraform for GCP (`infra/terraform/gcp/`):**
  - Provision Google Artifact Registry (Docker images).
  - Provision Google Cloud Storage (GCS) for build artifacts.
  - Provision Cloud Memorystore (Redis).
  - Provision Cloud Run / GKE cluster and IAM Service Accounts.
- [ ] **Kubernetes Driver (`KubernetesDriver`):**
  - Implement `ContainerRuntimeDriver` interface for Kubernetes.
  - Dynamically spawn Kubernetes Pods, Deployments, and ClusterIP Services via `@kubernetes/client-node`.
  - Kubernetes manifests & Helm chart for the entire PaaS.
- [ ] End-to-end cloud deployment verification.

---

## 🛠️ Complete Tech Stack Matrix

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Monorepo** | pnpm + Turborepo | Workspace management |
| **Database** | Neon / Supabase (PostgreSQL) | Persistence layer |
| **ORM** | Prisma ORM | Type-safe migrations & models |
| **Queue & Pub/Sub** | Redis + BullMQ | Asynchronous build queues & log/metric event bus |
| **API Server** | Fastify (TypeScript) | Control plane REST API & SSE broadcaster |
| **Reverse Proxy** | Fastify / `http-proxy` | Dynamic wildcard routing with Prometheus `/metrics` |
| **Runtime Drivers** | Docker Engine API + Kubernetes Driver | Pluggable container execution engines |
| **Observability** | Prometheus + Docker Stats + SSE | Real-time CPU, RAM, and HTTP latency telemetry |
| **Terminal** | `@xterm/xterm` + SSE | Browser-based live build terminal |
| **Frontend** | Next.js 14 + Tailwind + Lucide Icons | Developer control panel |
| **IaC** | Terraform (GCP) | Reproducible cloud infrastructure |

---

## 📌 Definition of Done (End State)
The project is complete when:
1. Developer enters a Git repository URL on the dashboard.
2. Build job is queued in Redis and executed with isolated cgroups.
3. Terminal streams colored build output live via Redis Pub/Sub → SSE → xterm.js.
4. Container passes health check → reverse proxy flips route atomically.
5. User visits `http://my-app.localhost:8000` and sees their running backend.
6. Dashboard displays live CPU & RAM usage charts.
7. Subsequent commits trigger a zero-downtime rolling switch.
8. The entire GCP infrastructure is reproducible via `terraform apply`.
