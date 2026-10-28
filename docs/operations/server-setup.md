# GAJIANICH Server Setup Runbook (Ubuntu 22.04 LTS)

This guide documents the exact server preparation steps for the GAJIANICH Development Server (`gajianich-dev`) and Production Server (`gajianich-prod`).

---

## 1. Development Server Setup (`gajianich-dev`)

### 1.1 Prerequisites & Docker Engine
```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg lsb-release git

# Install Docker Engine & Compose plugin
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin nodejs npm

# Allow non-root docker execution for dev user
sudo usermod -aG docker $USER
```

### 1.2 GitHub Actions Self-Hosted Runner Registration
Register a repository-scoped self-hosted runner:
1. In GitHub repo: **Settings > Actions > Runners > New self-hosted runner**.
2. Run installation commands as a dedicated service account.
3. Configure runner labels: `self-hosted, linux, x64, gajianich-dev`.
4. Install and start runner as a systemd service:
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

---

## 2. Production Server Setup (`gajianich-prod`)

### 2.1 Native PostgreSQL 16 Setup
Production runs native PostgreSQL managed by systemd:
```bash
sudo apt-get install -y postgresql-16 postgresql-client-16

# Create production database user and database
sudo -u postgres psql << 'SQL'
CREATE USER gajianich_app WITH PASSWORD '<STRONG_PRODUCTION_PASSWORD>';
CREATE DATABASE gajianich_prod_db OWNER gajianich_app;
GRANT ALL PRIVILEGES ON DATABASE gajianich_prod_db TO gajianich_app;
SQL

# Verify PostgreSQL is active and bound to localhost only
sudo systemctl enable --now postgresql
```

### 2.2 Dedicated Deployment Account & Directory
Create the unprivileged `gajianich-deploy` user and deployment directory:
```bash
sudo useradd -m -s /bin/bash -G docker gajianich-deploy
sudo mkdir -p /opt/gajianich /var/backups/gajianich/postgres
sudo chown -R gajianich-deploy:gajianich-deploy /opt/gajianich
sudo chown -R postgres:postgres /var/backups/gajianich/postgres
sudo chmod 700 /var/backups/gajianich/postgres

# Clone repository into /opt/gajianich
sudo -u gajianich-deploy git clone https://github.com/febryprasetyo/gajianich.git /opt/gajianich
```

### 2.3 Production Environment Configuration
Create `/opt/gajianich/.env` owned by `gajianich-deploy` with mode `600`:
```bash
sudo -u gajianich-deploy cp /opt/gajianich/deploy/.env.example /opt/gajianich/.env
sudo chmod 600 /opt/gajianich/.env
```
Edit `/opt/gajianich/.env` to configure production secrets:
- `DATABASE_URL=postgresql://gajianich_app:<STRONG_PASSWORD>@host.docker.internal:5432/gajianich_prod_db`
- `JWT_SECRET=<STRONG_RANDOM_SECRET_MIN_32_CHARS>`
- `JWT_REFRESH_SECRET=<STRONG_RANDOM_REFRESH_SECRET_MIN_32_CHARS>`

### 2.4 Systemd Scheduled Backups & Integrity Verification
Install backup and verification systemd units:
```bash
sudo cp /opt/gajianich/deploy/systemd/gajianich-postgres-backup.* /etc/systemd/system/
sudo cp /opt/gajianich/deploy/systemd/gajianich-postgres-verify.* /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now gajianich-postgres-backup.timer
sudo systemctl enable --now gajianich-postgres-verify.timer
```

### 2.5 Pinned SSH Host Key Setup
From the development runner machine, scan and record the production host key:
```bash
ssh-keyscan -H <PROD_LAN_IP>
```
Store the resulting host key line into the GitHub Secret `PROD_SSH_HOST_KEY`.
