---
name: verify-deployment-system
description: "Verification skill for Mini-Render / Railway Cloud-Native PaaS platform. Launches control-api, reverse-proxy, and orchestrator, runs doctor health checks, and exercises deployment pipelines."
---

# Verify Deployment System

This skill provides automated verification and health testing for the **deployment-system** platform.

## Launch
To start the services locally:
- Control API: `bun run dev:api` (port 4000)
- Reverse Proxy: `bun run dev:proxy` (port 8000)
- Orchestrator: `bun run dev:orchestrator`

## Doctor
Run the platform doctor check to verify dependencies, Docker connection, and environment:
```bash
bun run doctor
```

## Typecheck & Lint
Verify full codebase integrity:
```bash
bun run typecheck
bun run lint
```

## Drive Harness
- **Control API Health:** `curl -s http://localhost:4000/health` (expects status: ok)
- **Reverse Proxy Health:** `curl -s http://localhost:8000/health` (expects status: ok)
- **Docker Daemon Test:** `bun scripts/doctor.ts`

## Evidence
Evidence captured in logs and exit codes:
- Doctor exit code 0 proves Docker daemon, TypeScript compilation, and environment parsing are healthy.
