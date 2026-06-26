#!/bin/bash
set -e

DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"
APP_CONTAINER="bun-app"
APP_PORT="8010"
CERT_LIVE_DIR="./certbot/conf/live"
CERT_PATH="$CERT_LIVE_DIR/$DOMAIN/fullchain.pem"

echo "=== Starting SSL setup for $DOMAIN ==="

# ─────────────────────────────────────────────────────────────
# Create required directories
# ─────────────────────────────────────────────────────────────
mkdir -p ./nginx/conf.d
mkdir -p ./certbot/www/.well-known/acme-challenge
mkdir -p ./certbot/conf
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot

# ─────────────────────────────────────────────────────────────
# FIX 1: Certbot sometimes creates folder with -0001 suffix
# Renames it to the correct folder name nginx expects
# ─────────────────────────────────────────────────────────────
fix_cert_folder_name() {
  local WRONG_LIVE="$CERT_LIVE_DIR/${DOMAIN}-0001"
  local RIGHT_LIVE="$CERT_LIVE_DIR/${DOMAIN}"
  local WRONG_ARCHIVE="./certbot/conf/archive/${DOMAIN}-0001"
  local RIGHT_ARCHIVE="./certbot/conf/archive/${DOMAIN}"
  local WRONG_RENEWAL="./certbot/conf/renewal/${DOMAIN}-0001.conf"
  local RIGHT_RENEWAL="./certbot/conf/renewal/${DOMAIN}.conf"

  if [ -d "$WRONG_LIVE" ] && [ ! -d "$RIGHT_LIVE" ]; then
    echo "Fixing cert folder name: ${DOMAIN}-0001 → ${DOMAIN}"
    mv "$WRONG_LIVE"    "$RIGHT_LIVE"
    mv "$WRONG_ARCHIVE" "$RIGHT_ARCHIVE" 2>/dev/null || true
    mv "$WRONG_RENEWAL" "$RIGHT_RENEWAL" 2>/dev/null || true
    echo "Cert folder renamed successfully."
  else
    echo "Cert folder name is correct — no rename needed."
  fi
}

# ─────────────────────────────────────────────────────────────
# FIX 2: Replace certbot symlinks with real files
# Symlinks point to ../../archive/ which nginx container
# cannot see — so SSL fails with "No such file or directory"
# ─────────────────────────────────────────────────────────────
fix_symlinks() {
  local LIVE_DIR="$CERT_LIVE_DIR/$DOMAIN"
  echo "Fixing symlinks in $LIVE_DIR ..."

  for FILE in cert.pem chain.pem fullchain.pem privkey.pem; do
    TARGET=$(readlink -f "$LIVE_DIR/$FILE" 2>/dev/null || true)
    if [ -z "$TARGET" ]; then
      echo "  SKIP: $FILE is not a symlink or does not exist"
      continue
    fi
    if [ ! -f "$TARGET" ]; then
      echo "  ERROR: symlink target $TARGET does not exist!"
      exit 1
    fi
    cp --remove-destination "$TARGET" "$LIVE_DIR/$FILE"
    echo "  FIXED: $FILE (real file copied)"
  done

  sudo chown -R ubuntu:ubuntu ./certbot
  chmod -R 755 ./certbot
  echo "Symlinks fixed — nginx can now read real cert files."
}

# ─────────────────────────────────────────────────────────────
# FIX 3: Write HTTP-only config first so nginx doesn't crash
# on startup when cert files don't exist yet
# ─────────────────────────────────────────────────────────────
write_http_only_config() {
cat > ./nginx/conf.d/app.conf << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
NGINXEOF
  echo "HTTP-only nginx config written."
}

# ─────────────────────────────────────────────────────────────
# Write final HTTPS nginx config (Cloudflare-compatible)
# ─────────────────────────────────────────────────────────────
write_https_config() {
cat > ./nginx/conf.d/app.conf << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Cloudflare-compatible SSL
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;

    # Fix: allow large file uploads
    client_max_body_size      20M;

    location / {
        proxy_pass         http://$APP_CONTAINER:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXEOF
  echo "HTTPS nginx config written to ./nginx/conf.d/app.conf"
}

# ─────────────────────────────────────────────────────────────
# Validate and reload nginx safely
# ─────────────────────────────────────────────────────────────
validate_and_reload_nginx() {
  echo "Validating nginx config..."
  if ! docker compose exec nginx nginx -t; then
    echo "ERROR: nginx config invalid — fix errors above before reloading."
    exit 1
  fi
  docker compose exec nginx nginx -s reload
  echo "nginx reloaded successfully."
}

# ─────────────────────────────────────────────────────────────
# CASE 1: Certificate already exists → fix + redeploy
# ─────────────────────────────────────────────────────────────
if sudo test -f "$CERT_PATH" || sudo test -f "$CERT_LIVE_DIR/${DOMAIN}-0001/fullchain.pem"; then
  echo "Certificate already exists — running redeploy..."

  # Fix folder name, symlinks, then write HTTPS config
  fix_cert_folder_name
  fix_symlinks
  write_https_config

  docker compose up -d --build --remove-orphans
  sleep 5
  validate_and_reload_nginx

  echo ""
  echo "=== Redeploy complete! ==="
  echo "=== https://$DOMAIN is live ==="
  exit 0
fi

# ─────────────────────────────────────────────────────────────
# CASE 2: First time — issue SSL cert then deploy
# ─────────────────────────────────────────────────────────────
echo "No certificate found — starting first-time SSL setup..."

# FIX: Write HTTP-only config FIRST so nginx starts without crashing
write_http_only_config

# Tear down cleanly
docker compose down || true

# Start nginx only with HTTP config (no SSL yet — won't crash)
docker compose up -d --no-deps nginx
echo "Waiting for nginx to be ready..."
sleep 8

# Confirm nginx started
if ! docker ps --format '{{.Names}}' | grep -q '^nginx$'; then
  echo "ERROR: nginx failed to start!"
  docker logs nginx --tail 20
  exit 1
fi

echo "nginx is up — verifying port 80..."
curl -sf http://localhost:80 > /dev/null \
  && echo "port 80 OK" \
  || { echo "ERROR: port 80 not responding"; docker logs nginx --tail 20; exit 1; }

# Request SSL certificate
echo "Requesting certificate from Let's Encrypt..."
docker run --rm \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Fix ownership after certbot runs as root
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot
sleep 2

# Verify cert was created (check both possible folder names)
if ! sudo test -f "$CERT_PATH" && ! sudo test -f "$CERT_LIVE_DIR/${DOMAIN}-0001/fullchain.pem"; then
  echo "ERROR: Certificate not found after certbot run!"
  sudo ls -la ./certbot/conf/live/ 2>/dev/null || echo "live/ folder does not exist"
  docker logs nginx --tail 20
  exit 1
fi

echo "Certificate obtained successfully!"

# Fix folder name FIRST (handles -0001 suffix)
fix_cert_folder_name

# Fix symlinks so nginx container can read real files
fix_symlinks

# Write HTTPS config now that certs exist
write_https_config

# Stop everything cleanly
docker compose down || true

# Start full stack with correct HTTPS config
echo "Starting full application stack..."
docker compose up -d --build --remove-orphans

echo "Waiting for services to be ready..."
sleep 8

# Reload nginx with HTTPS config
validate_and_reload_nginx

# Final verification
echo ""
echo "Testing SSL connection..."
curl -sI https://$DOMAIN | head -5 || echo "WARNING: SSL test failed — check: docker logs nginx"

echo ""
echo "=== SSL setup complete! ==="
echo "=== https://$DOMAIN is now live! ==="