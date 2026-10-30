# ADMS Server Implementation Plan

> Execute inline using superpowers:executing-plans; preserve unrelated checkout work.

**Goal:** ADMS terpisah dan impor historis memakai database/log mentah Gajianich.
**Architecture:** HTTP receiver + transaction store + operator CLI + Docker Compose external DB network.
**Tech Stack:** Node.js 22+, pg, node:test, PostgreSQL 16.
**Spec:** ../specs/2026-10-30-adms-server-design.md

## Global Constraints
- Preserve payload before successful ACK; group-scoped PIN resolution; no device mutation commands.
- No production migrations/deployments during verification. UTC conversion must not change device wall time.
- No new UI; manual import accepts documented text layouts only.

## Review Focus
- Concurrent retry/manual overlap and pre-migration raw logs.
- Malformed batches, socket limits and DB outages.
- Spoofed/disabled/unregistered serial and unauthorized source networks.
- Employee collisions across groups and zero-padded PINs.
- ADMS online state and legacy pull preserving logs.

## Tasks
- [x] Write failing parser/HTTP tests; implement strict TSV parser and protocol endpoints.
- [x] Write PostgreSQL integration tests; implement additive migration, canonical dedup, receipt and watermark transactions.
- [x] Implement registration/status/import CLI with default dry-run and example TSV.
- [x] Adapt backend status and pull merge; fix device-aware calculation fallback.
- [x] Build/run isolated Docker tests, backend checks, document deployment and checkpoint.

## Execution ledger

- Ruling: use shared DB with additive schema owned by service; migration columns also journaled as 0038 to avoid concurrent office-shift migration0037.
- Ruling: no production deployment or machine changes during implementation; use disposable DBs for all verification.
- Ruling: shift calculation stays explicit through existing Gajianich workflow; receiver stores raw attendance automatically.
- Tests exposed UTC conversion in pull; fixed wall-clock insertion. Independent review exposed cross-group calculator fallback; reproduced failing integration test, fixed validated-ID-only calculation and reviewed again.
- All scoped checks pass. See docs/plan/2026-10-30-adms-server-checkpoint.md for evidence and material limitations.
