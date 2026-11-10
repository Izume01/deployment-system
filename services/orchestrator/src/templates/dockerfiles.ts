export const RUST_DOCKERFILE = `FROM rust:1.82-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY . .
RUN cargo build --release

FROM alpine:3.20 AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/release/* /app/server
USER appuser
ENV PORT=8080
EXPOSE 8080
CMD ["/app/server"]
`;

export const GO_DOCKERFILE = `FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server .

FROM alpine:3.20 AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/server /app/server
USER appuser
ENV PORT=8080
EXPOSE 8080
CMD ["/app/server"]
`;

export const PYTHON_DOCKERFILE = `FROM python:3.12-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim AS runner
WORKDIR /app
RUN useradd -m -u 1001 appuser
COPY --from=builder /root/.local /home/appuser/.local
COPY --chown=appuser:appuser . .
USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD exec uvicorn main:app --host 0.0.0.0 --port $PORT
`;

export const NEXTJS_DOCKERFILE = `FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
`;

export const STATIC_SPA_DOCKERFILE = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM nginx:alpine-slim AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
RUN echo 'server { listen 8080; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
`;

export const NODE_API_DOCKERFILE = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production || npm install --production
COPY . .

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app ./
USER appuser
EXPOSE 8080
CMD ["npm", "start"]
`;

export const BUN_DOCKERFILE = `FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production || bun install
COPY . .

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
USER bun
COPY --from=builder /app ./
EXPOSE 8080
CMD ["bun", "run", "start"]
`;

export const DENO_DOCKERFILE = `FROM denoland/deno:alpine AS runner
WORKDIR /app
USER deno
COPY deno.json* deno.lock* ./
COPY . .
RUN deno cache main.ts || deno cache server.ts || true
ENV PORT=8080
EXPOSE 8080
CMD ["run", "--allow-net", "--allow-env", "main.ts"]
`;
