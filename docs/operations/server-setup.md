# AMS Server Setup Runbook (Ubuntu 22.04 LTS)

This guide documents the exact server preparation steps for the AMS Development Server (`ams-dev`) and Production Server (`ams-prod`).

---

## 1. Development Server Setup (`ams-dev`)

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
3. Configure runner labels: `self-hosted, linux, x64, ams-dev`.
4. Install and start runner as a systemd service:
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

---

## 2. Production Server Setup (`ams-prod`)

### 2.1 Native PostgreSQL 16 Setup
Production runs native PostgreSQL managed by systemd:
```bash
sudo apt-get install -y postgresql-16 postgresql-client-16

# Create production database user and database
sudo -u postgres psql << 'SQL'
CREATE USER ams_app WITH PASSWORD '<STRONG_PRODUCTION_PASSWORD>';
CREATE DATABASE ams_prod_db OWNER ams_app;
GRANT ALL PRIVILEGES ON DATABASE ams_prod_db TO ams_app;
SQL

# Verify PostgreSQL is active and bound to localhost only
sudo systemctl enable --now postgresql
```

### 2.2 Dedicated Deployment Account & Directory
Create the unprivileged `ams-deploy` user and deployment directory:
```bash
sudo useradd -m -s /bin/bash -G docker ams-deploy
sudo mkdir -p /opt/ams-app /var/backups/ams-app/postgres
sudo chown -R ams-deploy:ams-deploy /opt/ams-app
sudo chown -R postgres:postgres /var/backups/ams-app/postgres
sudo chmod 700 /var/backups/ams-app/postgres

# Clone repository into /opt/ams-app
sudo -u ams-deploy git clone https://github.com/<owner>/ams-app.git /opt/ams-app
```

### 2.3 Production Environment Configuration
Create `/opt/ams-app/.env` owned by `ams-deploy` with mode `600`:
```bash
sudo -u ams-deploy cp /opt/ams-app/deploy/.env.example /opt/ams-app/.env
sudo chmod 600 /opt/ams-app/.env
```
Edit `/opt/ams-app/.env` to configure production secrets:
- `DATABASE_URL=postgresql://ams_app:<STRONG_PASSWORD>@host.docker.internal:5432/ams_prod_db`
- `JWT_SECRET=<STRONG_RANDOM_SECRET_MIN_32_CHARS>`
- `JWT_REFRESH_SECRET=<STRONG_RANDOM_REFRESH_SECRET_MIN_32_CHARS>`

### 2.4 Systemd Scheduled Backups & Integrity Verification
Install backup and verification systemd units:
```bash
sudo cp /opt/ams-app/deploy/systemd/ams-postgres-backup.* /etc/systemd/system/
sudo cp /opt/ams-app/deploy/systemd/ams-postgres-verify.* /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now ams-postgres-backup.timer
sudo systemctl enable --now ams-postgres-verify.timer
```

### 2.5 Pinned SSH Host Key Setup
From the development runner machine, scan and record the production host key:
```bash
ssh-keyscan -H <PROD_LAN_IP>
```
Store the resulting host key line into the GitHub Secret `PROD_SSH_HOST_KEY`.
