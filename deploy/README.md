# MapleDocs single-server deployment

This deployment targets one Linux server. PostgreSQL, Redis, MinIO, ONLYOFFICE
and collaboration services stay inside the Docker network. The published
address and port are configurable; the secure defaults expose only
`127.0.0.1:8083` for a host reverse proxy.

## 1. Prerequisites

Install Docker Engine, the Compose v2 plugin, Git and OpenSSL. Enable Docker at
boot:

```bash
sudo systemctl enable --now docker
docker version
docker compose version
```

Run the remaining commands from the repository root.

## 2. Generate production configuration

Choose one DNS name that resolves to the server on the LAN, through the private
network, or over IPv6. The same HTTPS origin must be used by every client.

```bash
chmod +x deploy/init-production-env.sh
./deploy/init-production-env.sh docs.example.internal
```

The script creates `deploy/production.env`, generates independent secrets and
sets its mode to `0600`. Review the file before starting. Local email/password
accounts and self-registration are enabled; OIDC and comments are disabled.

For a first LAN-only test without Nginx or TLS, generate an HTTP configuration.
Replace the example address with the Arch server's stable LAN address:

```bash
./deploy/init-production-env.sh 192.168.1.20 \
  --scheme http --bind 0.0.0.0 --port 4332
```

Then open `http://192.168.1.20:4332`. This mode disables HTTPS redirects and
secure-only login cookies. Use it only on a trusted LAN. For a generated file,
the listener can be changed with `MAPLEDOCS_HTTP_BIND` and
`MAPLEDOCS_HTTP_PORT`; public URLs and cookie settings must still match the
origin clients use. When a reverse proxy's public port differs from the listener,
pass `--public-port` to the generator; HTTPS defaults to public port `443`.

## 3. Configure host Nginx (optional for LAN testing)

Copy `deploy/nginx-mapledocs.conf.example` into the host Nginx configuration.
Replace the example domain and certificate paths. The configuration listens on
both IPv4 and IPv6 and forwards HTTP, WebSocket and ONLYOFFICE traffic to
`127.0.0.1:8083`.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The default production configuration requires HTTPS. For a public IPv6 domain,
use a publicly trusted certificate. For a LAN-only name, use an internal CA
trusted by every client device. The explicit HTTP mode above is intended only
for temporary LAN testing.

## 4. Build and start

```bash
docker compose --env-file deploy/production.env \
  -f compose.production.yml up -d --build
```

The first start creates the PostgreSQL schema, MinIO bucket and object versioning
automatically. The one-shot `migrate` and `create-bucket` containers are expected
to finish with exit code 0.

Create the first administrator:

```bash
docker compose --env-file deploy/production.env \
  -f compose.production.yml run --rm backend \
  python manage.py createsuperuser
```

Inspect status and logs:

```bash
docker compose --env-file deploy/production.env \
  -f compose.production.yml ps
docker compose --env-file deploy/production.env \
  -f compose.production.yml logs -f backend frontend y-provider onlyoffice
```

## 5. Upgrade

```bash
git pull
docker compose --env-file deploy/production.env \
  -f compose.production.yml build --pull
docker compose --env-file deploy/production.env \
  -f compose.production.yml run --rm migrate
docker compose --env-file deploy/production.env \
  -f compose.production.yml up -d --remove-orphans
```

All long-running containers use `restart: unless-stopped`, so they return when
Docker starts after a reboot. PostgreSQL does not publish port 5432 and cannot
conflict with a MariaDB service on the host.

## 6. Backup

At minimum, back up PostgreSQL and MinIO. The commands below write into a local
`backups` directory:

```bash
mkdir -p backups
docker compose --env-file deploy/production.env \
  -f compose.production.yml exec -T postgresql \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > backups/mapledocs-postgresql.dump
docker run --rm \
  -v mapledocs_minio_data:/source:ro \
  -v "$PWD/backups:/backup" \
  alpine tar -C /source -czf /backup/mapledocs-minio.tar.gz .
```

Back up `deploy/production.env` separately with restricted permissions. Never run
`docker compose down -v` unless permanent deletion of all named-volume data is
intended.
