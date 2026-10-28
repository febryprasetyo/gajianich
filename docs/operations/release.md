# GAJIANICH Release and Deployment Runbook

## Overview

GAJIANICH production releases are automated via GitHub Actions (`.github/workflows/release.yml`) and deploy exclusively over the local network (LAN) using SSH with pinned host key authentication.

---

## 1. Required GitHub Settings & Secrets

### 1.1 GitHub Secrets
Configure under **Settings > Secrets and variables > Actions**:
- `PROD_HOST`: Local LAN IP or hostname of the production server (e.g. `192.168.10.50`).
- `PROD_SSH_KEY`: OpenSSH Ed25519 private key corresponding to `gajianich-deploy` user on production.
- `PROD_SSH_HOST_KEY`: Pinned `known_hosts` entry for the production server (from `ssh-keyscan -H <PROD_IP>`).

### 1.2 GitHub Environment: `production`
Configure under **Settings > Environments > production**:
- **Required reviewers:** Add authorized release managers.
- **Deployment branches:** Selected branches / tags only (`v*.*.*`).

---

## 2. Creating a Production Release

1. **Verify `master` branch status:** Ensure all PRs are merged and CI status checks pass.
2. **Create and push an annotated semantic version tag:**
   ```bash
   git checkout master
   git pull origin master
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
3. **Workflow Execution:**
   - GitHub Actions automatically runs `build-and-publish`, building Docker images and publishing them to GHCR (`ghcr.io/febryprasetyo/gajianich-backend:v1.0.0` and `ghcr.io/febryprasetyo/gajianich-frontend:v1.0.0`).
   - The workflow enters the `production` environment and waits for manual approval.
4. **Approve Release:**
   - Designated approvers review the release in GitHub Actions UI and approve the deployment.
5. **Automated LAN Deployment:**
   - The self-hosted runner connects to production over LAN SSH.
   - Executes preflight checks.
   - Creates a verified pre-deployment PostgreSQL backup.
   - Pulls release images.
   - Runs database migrations once.
   - Replaces containers.
   - Verifies health on `/healthz` and `/health/ready`.
   - Atomically records `v1.0.0` into `/opt/gajianich/current-version`.

---

## 3. Rollback Procedures

### 3.1 Automatic Rollback
If application health checks fail after container startup, `deploy.sh` automatically restores the preceding healthy container image version without executing database down-migrations.

### 3.2 Manual Rollback Command
To explicitly roll back to a specific previous release tag:
```bash
ssh gajianich-deploy@<PROD_HOST>
/opt/gajianich/deploy/scripts/rollback.sh v1.0.0 --yes
```
This pulls `v1.0.0`, starts containers, verifies health, and atomically updates `current-version`.
