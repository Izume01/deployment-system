# Mini-Render / Railway: Backend Application Deployment Platform
## Comprehensive Architectural Specification (v2.0 - Cloud Native & Enterprise Grade)

---

### 1. Executive Summary

The platform is an enterprise-grade, cloud-ready **Platform as a Service (PaaS)** for deploying containerized backend applications (Node.js, Python, Go, Rust, Ruby, Dockerfiles). 

A developer connects any Git repository and specifies environment variables. The platform automatically:
1. **Queues & Orchestrates via Redis:** Jobs are queued via BullMQ to decouple HTTP API requests from resource-heavy builds.
2. **Builds with Multi-Runtime Drivers:** Compiles code into an OCI container image using either the **Docker Engine API** (local development) or a **Kubernetes Pod Driver** (production GKE/Cloud Run).
3. **Deploys with Zero Downtime:** Spins up the container on an isolated internal network (`paas-internal-network`), enforces cgroup limits (CPU/RAM/PIDs), verifies health checks (`GET /health`), dynamically switches the reverse proxy routing table, and gracefully terminates old containers.
4. **Routes Traffic:** Intercepts wildcard hostnames (`http://<project-slug>.localhost:8000` or custom domains) with Prometheus latency/throughput telemetry.
5. **Real-time Observability & Telemetry:** Streams build and container logs via **Redis Pub/Sub** to the browser (`xterm.js`), while streaming real-time CPU & RAM usage graphs.
6. **Infrastructure as Code (IaC):** Codifies all cloud infrastructure using **Terraform** for Google Cloud Platform (GCP).

---

### 2. High-Level System Architecture

```mermaid
graph TD
    subgraph ClientLayer ["1. Client & Developer Layer"]
        UserBrowser["Developer Browser / Public Users"]
        UserBrowser -->|"Dashboard UI & Live Metrics"| WebDashboard["Next.js Web Dashboard (:3000)"]
        UserBrowser -->|"HTTP Request (*.localhost:8000)"| ReverseProxy["Dynamic Reverse Proxy (:8000)"]
    end

    subgraph ControlPlane ["2. Control Plane & Messaging"]
        ControlAPI["Control Plane API (:4000 Fastify)"]
        WebDashboard -->|"REST / tRPC API"| ControlAPI
        PrismaORM["Prisma Client"]
        ControlAPI --> PrismaORM
        PostgresDB[("Neon / Supabase PostgreSQL")]
        PrismaORM --> PostgresDB
        
        RedisQueue[("Redis: BullMQ Queue & Pub/Sub")]
        ControlAPI -->|"Push Build Job"| RedisQueue
        RedisQueue -->|"Broadcast SSE Logs"| ControlAPI
        ControlAPI -->|"Stream Logs & CPU/RAM"| WebDashboard
    end

    subgraph OrchestrationLayer ["3. Orchestration & Execution Engine"]
        BuildWorker["Build & Deploy Worker"]
        RedisQueue -->|"Consume Job"| BuildWorker
        
        RuntimeDriver{"Runtime Driver Interface"}
        BuildWorker --> RuntimeDriver
        
        DockerDriver["Docker Engine API (Local)"]
        K8sDriver["Kubernetes Driver (GKE / Cloud)"]
        RuntimeDriver --> DockerDriver
        RuntimeDriver --> K8sDriver
    end

    subgraph ContainerRuntime ["4. Container Runtime & Telemetry"]
        paasNet["Isolated Bridge: paas-internal-network"]
        DockerDriver --> paasNet
        AppV1["App v1 Container (Old)"]
        AppV2["App v2 Container (New :8080)"]
        paasNet --> AppV1
        paasNet --> AppV2
        
        ReverseProxy -->|"Dynamic Route Lookup"| AppV2
        
        StatsCollector["Stats & Telemetry Engine"]
        AppV2 -->|"CPU / RAM / Net I/O"| StatsCollector
        StatsCollector -->|"Publish Stats"| RedisQueue
        ReverseProxy -->|"/metrics"| Prometheus["Prometheus Metrics"]
    end

    subgraph CloudInfra ["5. Cloud Infrastructure (Terraform)"]
        Terraform["Terraform (GCP)"]
        Terraform --> ArtifactRegistry["GCP Artifact Registry"]
        Terraform --> GCS["Google Cloud Storage"]
        Terraform --> CloudRun["Cloud Run / GKE Cluster"]
        Terraform --> CloudDNS["Cloud DNS & SSL Load Balancer"]
    end
```

---

### 3. Asynchronous Deployment Lifecycle (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant UI as Web Dashboard
    participant API as Control API
    participant DB as Neon/Supabase DB
    participant Redis as Redis (BullMQ & Pub/Sub)
    participant Worker as Orchestrator Worker
    participant Runtime as Runtime Driver (Docker/K8s)
    participant Proxy as Reverse Proxy

    Dev->>UI: Clicks "Deploy" (or Git Webhook)
    UI->>API: POST /api/projects/:id/deployments
    API->>DB: Insert Deployment (status: QUEUED)
    API->>Redis: BullMQ.add('build-job', { deploymentId, repoUrl, envVars })
    API-->>UI: 202 Accepted (Deployment Queued)

    Redis->>Worker: Worker pulls job
    Worker->>DB: Update Deployment (status: BUILDING)
    Worker->>Redis: Publish log: "Cloning repository..."
    Redis-->>UI: SSE streams log line to xterm.js

    Worker->>Runtime: buildImage(repoUrl, gitBranch)
    loop Stream Build Output
        Runtime-->>Worker: stdout/stderr chunk
        Worker->>Redis: Publish log: chunk
        Redis-->>UI: Real-time colored terminal stream
    end

    Runtime-->>Worker: Image Built (tag: project-a:dep_994)
    Worker->>DB: Update Deployment (status: STARTING)
    
    Worker->>Runtime: startContainer(image, envVars, cgroupLimits)
    
    rect rgb(235, 248, 255)
        Note over Worker,Runtime: Zero-Downtime Health Check Polling
        loop Ping Container Health
            Worker->>Runtime: GET /health or TCP Probe (:internalPort)
            Runtime-->>Worker: 200 OK (Healthy!)
        end
    end

    Worker->>Proxy: registerRoute(projectSlug, containerAddress)
    Proxy->>Redis: Cache route (slug -> containerAddress)
    Proxy-->>Proxy: In-memory atomic route flip

    opt If old container active
        Worker->>Runtime: Graceful shutdown (SIGTERM 10s -> SIGKILL)
    end

    Worker->>DB: Update Deployment (status: RUNNING)
    Worker->>Redis: Publish event: "Deployment Live!"
    Redis-->>UI: Badge updates to RUNNING + Live URL ready
```

---

### 4. Core System Subsystems & Interfaces

#### A. Asynchronous Queue & Messaging (Redis & BullMQ)
* **Job Queue:** Isolates heavy compiler/Docker commands from the HTTP API.
* **Concurrency Limiting:** Enforces maximum parallel builds (e.g. 2 simultaneous builds on dev machine, scalable horizontally in cloud).
* **Pub/Sub Channels:**
  * `deployments:<id>:logs` → Streamed to SSE clients.
  * `deployments:<id>:status` → Real-time status badge transitions.
  * `projects:<id>:metrics` → Streamed CPU/RAM usage.

#### B. Pluggable Runtime Driver Interface
The orchestrator is decoupled from the specific container daemon:
```typescript
export interface ContainerRuntimeDriver {
  buildImage(options: BuildOptions): Promise<BuildResult>;
  startContainer(config: ContainerConfig): Promise<RunningContainer>;
  pollHealth(containerId: string, timeoutMs: number): Promise<boolean>;
  getStats(containerId: string): Promise<ContainerStats>; // CPU %, Memory MB
  stopContainer(containerId: string, gracePeriodMs: number): Promise<void>;
  getLogsStream(containerId: string): NodeJS.ReadableStream;
}
```
* **`DockerDriver`:** Uses `dockerode` over local `/var/run/docker.sock`.
* **`KubernetesDriver`:** Uses `@kubernetes/client-node` to orchestrate K8s Pods, ReplicaSets, and ClusterIP Services on GKE.

#### C. Observability & Telemetry Architecture
* **Prometheus Metrics:** The Reverse Proxy exports:
  * `http_requests_total{slug, status_code}`
  * `http_request_duration_seconds{slug, quantile}`
  * `active_deployments_total`
* **Resource Monitoring:** Orchestrator queries cgroups memory/CPU stats every 3 seconds:
  ```typescript
  interface ContainerStats {
    cpuPercentage: number;
    memoryUsageBytes: number;
    memoryLimitBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
  }
  ```
* **Dashboard Telemetry:** Next.js UI charts live CPU/RAM utilization curves for each running project.

#### D. Dynamic Reverse Proxy & Edge Routing
* Subdomain extraction: `http://<slug>.localhost:8000` → `slug`.
* Fast route lookup: In-memory `Map<string, RouteTarget>` backed by Redis invalidation.
* Transparent WebSocket and HTTP proxying using `http-proxy`.
* Custom error boundary:
  * 503 Bad Gateway with human-readable "Container Starting..." auto-refreshing landing page.

#### E. Infrastructure as Code (Terraform for GCP)
Directory: `infra/terraform/gcp/`
* `main.tf`, `variables.tf`, `outputs.tf`
* Provisions:
  1. **Google Artifact Registry:** Stores custom base images and built user containers.
  2. **Google Cloud Run / GKE:** Serverless container cluster.
  3. **Cloud Memorystore for Redis:** Managed high-throughput Redis instance.
  4. **Google Cloud Storage (GCS):** Stores build logs and build cache bundles.
  5. **Cloud Load Balancing & Cloud Armor:** Wildcard HTTPS termination and DDoS protection.

---

### 5. Database Schema (Neon / Supabase PostgreSQL)

```mermaid
erDiagram
    User ||--o{ Project : owns
    Project ||--o{ Deployment : has
    Project ||--o{ EnvironmentVariable : configures
    Project ||--o{ MetricSnapshot : records
    Project ||--o{ CustomDomain : maps

    Project {
        string id PK "cuid/uuid"
        string name
        string slug UK "subdomain identifier"
        string repoUrl
        string branch "default: main"
        int targetPort "default: 3000"
        datetime createdAt
        datetime updatedAt
    }

    Deployment {
        string id PK "cuid/uuid"
        string projectId FK
        string commitHash
        string status "QUEUED|BUILDING|STARTING|RUNNING|FAILED|STOPPED"
        string containerId
        string imageTag
        datetime startedAt
        datetime completedAt
    }

    EnvironmentVariable {
        string id PK
        string projectId FK
        string key
        string value
        boolean isSecret
    }

    MetricSnapshot {
        string id PK
        string projectId FK
        float cpuPercent
        float memoryMb
        datetime recordedAt
    }

    CustomDomain {
        string id PK
        string projectId FK
        string domainName UK
        boolean sslActive
    }
```

---

### 6. Container Security & Sandboxing (cgroups)

To protect host hardware from runaway processes and malicious code:
* **Memory Limits:** `Memory: 536870912` (512 MB hard cap).
* **Swap Memory:** `MemorySwap: 536870912` (Swap disabled to prevent disk thrashing).
* **CPU Quota:** `NanoCPUs: 1000000000` (Max 1.0 vCPU core).
* **Process Limit:** `PidsLimit: 100` (Mitigates fork bombs).
* **Non-Root Execution:** App runs under unprivileged container user (`USER node` / `USER appuser`).
* **Isolated Network:** Attached strictly to `paas-internal-network` (containers cannot reach host ports).
