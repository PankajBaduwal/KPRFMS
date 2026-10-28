# FacultyCore — production setup, operations and recovery

> **Status:** this configuration has been built and tested locally and in CI only. FacultyCore has
> **not** been deployed to a production server yet. Treat this guide as the plan for the first
> deployment and update it with what you actually did.

## 1. What runs where

| Piece | What it is | Notes |
|---|---|---|
| `web` | nginx serving the built React app, proxying `/api` and `/uploads` to the API | One public origin; no CORS needed |
| `server` | Node 22 API (`dist/server.js`) | Stateless except the live-notification streams (see §9) and files on its volume |
| `mongo` | MongoDB 8.2 | One server/cluster holds every database |

Databases on the MongoDB server:

| Database | Contents |
|---|---|
| `fc_platform` (`PLATFORM_DB_NAME`) | Institution registry, Super Admin accounts and sessions, provisioning runs, platform audit log |
| `fc_t_<code>` (`TENANT_DB_PREFIX` + code) | Everything belonging to one institution: users, faculty, records, settings, audit log |

Files: `storage/tenants/<code>/{uploads,secure_documents,branding}` on the `documents` volume.
The institution is never taken from the client: it comes from the signed session token, or from
the registry for `/api/t/<code>/…` sign-in and public routes. Unknown or suspended institutions are
refused; there is no default institution.

## 2. Environment variables

Set these in `.env.production` (never commit it; `.env.production.example` is the template).

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | yes | Signs institution sessions; the platform console key is derived from it. 48+ random bytes |
| `COOKIE_SECRET` | yes | Signs cookies. 48+ random bytes |
| `TWO_FACTOR_KEY` | yes | Encrypts two-factor secrets. **Never change after go-live** (it switches everyone's 2FA off) |
| `CLIENT_URL` | yes | Public HTTPS address of the app (CORS, email links) |
| `MONGODB_URI` | for external DB | Full URI with credentials. Unset = bundled `mongo` container |
| `PLATFORM_DB_NAME` | no | Default `fc_platform`. Change only before first start |
| `TENANT_DB_PREFIX` | no | Default `fc_t_`. Change only before first start |
| `TENANT_STATUS_CACHE_MS` | no | How long one API instance may keep a cached institution status (default 15 s in compose). Suspension takes effect at once on the instance that performed it |
| `PUBLIC_API_URL` | no | Public API base for calendar-feed links (default `<CLIENT_URL>/api` behind nginx) |
| `TRUST_PROXY` | set by compose | `1` behind one proxy hop: correct client IPs, rate limits and Secure cookies |
| `JWT_EXPIRES_IN` | no | Idle session lifetime (default 12h); institutions can set a shorter idle timeout in Settings |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` | yes in production | Outgoing email. Without `SMTP_HOST` mail is only written to the outbox folder |
| `MAIL_FROM` | yes | Sender address; each email shows "<Institution> via FacultyCore" as the display name |
| `GEMINI_API_KEY` | no | Empty = AI features off. `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` select models |
| `BACKUP_DIR`, `BACKUP_KEEP` | no | Backup folder (compose: `/app/backups` volume) and how many to keep per institution |
| `WEB_PORT` | no | Host port of the web container (default 8080) |

The API refuses to start in production with missing or weak secrets. Logs redact passwords,
tokens, cookies and keys; error responses never include stack traces or connection strings.

## 3. MongoDB

* **MongoDB version and host kernel.** MongoDB 8.0 refuses to start on Linux 6.19 and newer
  (SERVER-121912). The bundled stack therefore uses **MongoDB 8.2**, which CI verified on a 7.0
  kernel (7.0 and 9.0 also started; 8.0 did not). Development on Windows uses 8.0, which is
  data-compatible. With a managed cluster, choose a version the provider supports.
* **Use a replica set** (three members, or a managed cluster such as MongoDB Atlas) for durability
  and point-in-time recovery. The bundled single container is fine for evaluation only.
* **Enable authentication.** Create one application user. It needs `readWrite` on `fc_platform`
  and on every `fc_t_*` database, plus permission to create new databases when institutions are
  provisioned. The simplest correct role is `readWriteAnyDatabase` on a cluster used only by
  FacultyCore; with a shared cluster, grant per-database roles and add each new institution's
  database before provisioning it.
* Put the credentials only in `MONGODB_URI` in `.env.production`, use TLS (`mongodb+srv://` or
  `tls=true`), and restrict network access to the API hosts.
* Indexes (including the unique ones) are created by provisioning and `tenant:register`.

## 4. First start

```bash
cp .env.production.example .env.production      # fill in secrets, CLIENT_URL, SMTP
docker compose --env-file .env.production up -d --build --wait
curl -fsS https://<your-domain>/api/health/ready
# One-time: create the first Super Admin (prints a single-use activation link, valid 24 h)
docker compose exec server node dist/scripts/platform-create-admin.js --email owner@example.com --name "Platform Owner"
```

Open the link, choose a password, then sign in to the console at `/platform`.

## 5. Adding an institution

**Console (normal path):** Platform console → New institution. The wizard validates the input,
then provisions in resumable steps (registry → database → settings → departments → accounts →
invitations → verification). A failed run leaves the institution unusable and can be resumed from
its page. Each account gets a single-use "set your password" email; administrators can later send
reminders (Admin → Users) to anyone who has not signed in.

**Bringing in an existing single-college FacultyCore database** (as done for KPRIET):

```bash
docker compose exec server node dist/scripts/tenant-migrate.js --from <old-db> --code <code> --name "<Name>" --domain <email-domain>
docker compose exec server node dist/scripts/tenant-files-copy.js --tenant <code>
docker compose exec server node dist/scripts/tenant-migrate-funding.js --tenant <code>      # funding verification state
docker compose exec server node dist/scripts/tenant-normalize-hod.js --tenant <code>        # department heads as user ids
```

`tenant-migrate` archives and verifies the source (counts, content hashes, references) before and
after copying and never changes it. All migration tools only add missing data and are safe to run
again; take a backup first (§7).

## 6. HTTPS and domains

* Serve one public name, e.g. `https://faculty.example.edu`, and set `CLIENT_URL` to it.
  Institutions are selected inside the app (institution picker, `?institution=<code>` links in
  emails, `/api/t/<code>` for sign-in); they do not need their own domains.
* Terminate TLS in front of the `web` container (Caddy, nginx, a cloud load balancer). Forward
  `X-Forwarded-For`/`X-Forwarded-Proto`, keep `TRUST_PROXY=1`, and redirect HTTP to HTTPS.
  Production cookies are `Secure`, so the app does not work over plain HTTP.
* Allow long-lived responses for `/api/notifications/stream` and `/api/t/*/notifications/stream`
  (no buffering, read timeout ≥ 1 h) — already configured in the bundled nginx.

## 7. Backups and restore

```bash
# Daily (cron / scheduled task): platform registry + every institution, each in its own folder
docker compose exec server node dist/scripts/backup.js --all
# One institution, or only the platform
docker compose exec server node dist/scripts/backup.js --tenant <code>
docker compose exec server node dist/scripts/backup.js --platform
```

Backups are gzipped Extended JSON plus the institution's files, in `backups/<code>-<time>/`
and `backups/platform-<time>/`; the newest `BACKUP_KEEP` per institution are kept. **Copy them off
the host** (object storage with versioning) — the volume alone is not a backup. With a managed
cluster also enable its snapshots / point-in-time recovery.

Restore (dry run without `--yes`; restart the API afterwards):

```bash
docker compose exec server node dist/scripts/restore.js backups/<code>-<time> --tenant <code> --yes
docker compose exec server node dist/scripts/restore.js backups/platform-<time> --platform --yes
```

A backup can only be restored into the institution (or platform) it came from. Test a restore
into a scratch environment at least once a term.

## 8. Monitoring

* **Liveness:** `GET /api/health` (process up). **Readiness:** `GET /api/health/ready` — 200 only
  when MongoDB, the registry and every active institution's database answer; 503 otherwise. The
  container health check uses readiness.
* **Logs** go to stdout (`docker compose logs server`). Each line carries `[req:<id>]` and
  `[inst:<code>]`; responses return the same id in `X-Request-Id` and error bodies include
  `requestId`, so a user's error report can be matched to the log. nginx passes its `$request_id`.
* Alert on: readiness failing, 5xx rate, repeated `Readiness check failed` / `Database unavailable`
  log lines, backup job failures, disk space on the volumes, certificate expiry.
* The platform console shows per-institution usage and the platform audit log; each institution's
  audit log is under Admin → Audit logs.

## 9. Scaling notes

* Live notifications keep their connections in the API process. Run **one API instance**, or add
  a shared pub/sub (e.g. Redis) in `services/notification-dispatch.ts` before running several.
* Files are on a local volume. Several API hosts need shared storage (or object storage support,
  not implemented yet).

## 10. Deployment and rollback

Deploy:

1. Take a backup (`backup.js --all`) and note the current image tag / git commit.
2. `git pull` (or pull the new images), then `docker compose --env-file .env.production up -d --build --wait`.
3. Check `/api/health/ready`, sign in to one institution and to the console.
4. Run any migration the release notes name (they are additive and re-runnable).

Roll back:

1. Re-deploy the previous commit / image tag (`git checkout <previous>` then `up -d --build`).
2. Code changes in this transformation only **add** fields and collections, so the previous
   version can run on the newer data. Restore a backup only if data was damaged.
3. The pre-multi-tenant KPRIET database (`kpriet-fms-backup-20261026`) and the old shared upload
   folders are kept untouched by the migration; they remain available for a full rollback.

## 11. Security checklist before go-live

- [ ] Secrets generated fresh for production; `.env.production` readable only by the deploy user
- [ ] MongoDB authentication + TLS on; no public MongoDB port
- [ ] HTTPS with HTTP → HTTPS redirect; HSTS at the proxy
- [ ] SMTP configured and a test password-reset email received
- [ ] `backup.js --all` scheduled, copied off-host, one restore rehearsed
- [ ] Readiness monitored; logs retained
- [ ] First Super Admin created and the activation link used (the platform console has no
      two-factor sign-in yet: use a long unique password and limit who has console accounts)
- [ ] Institution administrators asked to turn on two-factor sign-in (profile menu → Account & Security)
- [ ] AI key set only if the institutions have agreed to the data-processing terms
