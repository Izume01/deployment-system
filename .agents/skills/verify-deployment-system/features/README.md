# Feature Map: Deployment System PaaS

This directory maps the core user journeys of the deployment platform.

## Features
1. `01-project-creation.md`: User defines a new project with repo URL and env vars.
2. `02-deployment-orchestration.md`: Orchestrator builds and launches container with isolated cgroups.
3. `03-dynamic-routing.md`: Reverse proxy dynamically routes `<slug>.localhost:8000` to the active container.
4. `04-zero-downtime-swap.md`: Blue-green traffic switch after health check passes.
