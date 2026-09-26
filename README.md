# SHADOWBOX

An IBM Bob-powered developer workflow tool that investigates
environment-dependent software failures, reproduces them in an
isolated environment, and verifies fixes.

## Core workflow

Failure → Investigation → Root Cause → Reproduction → Fix → Verification

## Technology

- IBM Bob 2.0 — investigation and engineering workflow
- React + Vite — frontend
- Node.js + Express — backend
- Docker — isolated reproduction runtime

## Team ownership

- Nishant: IBM Bob workflow, demo application, integration
- Pratik: frontend
- Surabhi: backend and Docker reproduction runtime

## Repository structure

- `frontend/` — web dashboard
- `backend/` — workflow API
- `demo-app/` — controlled environment-dependent failure
- `shadowbox/` — Docker reproduction
- `docs/` — architecture and documentation