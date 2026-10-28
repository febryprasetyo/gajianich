# GAJIANICH Database Recovery Runbook

## Overview

GAJIANICH uses native PostgreSQL custom-format backups (`.dump`) with SHA256 checksums. Backups are stored in `/var/backups/gajianich/postgres`.

> [!CAUTION]
> **Strict Policy:** Automated blind restore into the active production database (`gajianich_prod_db`) is strictly prohibited. Database recovery must always restore into an isolated verification or recovery database first.

---

## 1. Inspecting Available Backups

List all available verified backups and checksums:
```bash
ls -lh /var/backups/gajianich/postgres
```

Verify the SHA256 checksum of a selected backup:
```bash
cd /var/backups/gajianich/postgres
sha256sum -c gajianich_prod_db_20260820_020000.dump.sha256
```

Verify dump table of contents:
```bash
pg_restore --list /var/backups/gajianich/postgres/gajianich_prod_db_20260820_020000.dump
```

---

## 2. Safe Recovery Procedure (Isolated Target DB)

1. **Create a temporary recovery database:**
   ```bash
   sudo -u postgres psql -c "CREATE DATABASE gajianich_recovery_test OWNER gajianich_app;"
   ```
2. **Restore backup into the recovery database:**
   ```bash
   /opt/gajianich/deploy/scripts/restore-postgres.sh /var/backups/gajianich/postgres/gajianich_prod_db_20260820_020000.dump gajianich_recovery_test
   ```
3. **Validate data integrity:**
   ```bash
   sudo -u postgres psql -d gajianich_recovery_test -c "SELECT count(*) FROM users; SELECT count(*) FROM assets;"
   ```
4. **Clean up test database:**
   ```bash
   sudo -u postgres psql -c "DROP DATABASE gajianich_recovery_test;"
   ```

---

## 3. Emergency Active Database Overwrite (Authorized Incidents Only)

In the event of total data corruption where full restoration over the active production database is required and approved by operations management:

```bash
/opt/gajianich/deploy/scripts/restore-postgres.sh /var/backups/gajianich/postgres/<backup-file>.dump gajianich_prod_db --force-production-overwrite
```
