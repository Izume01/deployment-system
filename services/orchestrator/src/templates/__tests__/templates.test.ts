import { describe, expect, it } from 'bun:test';
import { TEMPLATE_METADATA, getDockerfileTemplate } from '../index';

describe('Production Dockerfile Templates', () => {
  it('should return optimized Rust multi-stage Dockerfile', () => {
    const template = getDockerfileTemplate('rust');
    expect(template).not.toBeNull();
    expect(template).toContain('FROM rust:1.82-alpine AS builder');
    expect(template).toContain('cargo build --release');
    expect(template).toContain('FROM alpine:3.20 AS runner');
    expect(template).toContain('USER appuser');
  });

  it('should return optimized Go multi-stage Dockerfile', () => {
    const template = getDockerfileTemplate('go');
    expect(template).not.toBeNull();
    expect(template).toContain('FROM golang:1.23-alpine AS builder');
    expect(template).toContain('CGO_ENABLED=0');
    expect(template).toContain('FROM alpine:3.20 AS runner');
  });

  it('should return optimized Python FastAPI/Flask Dockerfile', () => {
    const template = getDockerfileTemplate('python');
    expect(template).not.toBeNull();
    expect(template).toContain('FROM python:3.12-slim AS builder');
    expect(template).toContain('uvicorn');
    expect(template).toContain('USER appuser');
  });

  it('should return Next.js standalone Dockerfile', () => {
    const template = getDockerfileTemplate('next');
    expect(template).not.toBeNull();
    expect(template).toContain('.next/standalone');
    expect(template).toContain('server.js');
  });

  it('should return Static SPA Nginx Dockerfile', () => {
    const template = getDockerfileTemplate('static-spa');
    expect(template).not.toBeNull();
    expect(template).toContain('FROM nginx:alpine-slim AS runner');
    expect(template).toContain('try_files $uri $uri/ /index.html');
  });

  it('should return Node API Dockerfile for express/fastify', () => {
    const template = getDockerfileTemplate('express');
    expect(template).not.toBeNull();
    expect(template).toContain('FROM node:20-alpine');
    expect(template).toContain('npm');
  });

  it('should return null for unsupported language', () => {
    const template = getDockerfileTemplate('cobol');
    expect(template).toBeNull();
  });

  it('should provide metadata with small estimated sizes (<80 MB)', () => {
    for (const meta of Object.values(TEMPLATE_METADATA)) {
      expect(meta.estimatedSizeMb).toBeLessThanOrEqual(70);
    }
  });
});
