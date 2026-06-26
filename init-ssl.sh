#!/bin/bash
set -e

DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"
APP_CONTAINER="bun-app"
APP_PORT="8010"
CERT_LIVE_DIR="./certbot/conf/live"
CERT_ARCHIVE_DIR="./certbot/conf/archive"
CERT_PATH="$CERT_LIVE_DIR/$DOMAIN/fullchain.pem"

echo "=== Starting SSL setup for $DOMAIN ==="

mkdir -p ./nginx/conf.d
mkdir -p ./certbot/www/.well-known/acme-challenge
mkdir -p ./certbot/conf
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot

# ─────────────────────────────────────────────────────────────
# FIX 1: Certbot sometimes creates folder with -0001 suffix
# ─────────────────────────────────────────────────────────────
fix_cert_folder_name() {
  local WRONG_LIVE="$CERT_LIVE_DIR/${DOMAIN}-0001"
  local RIGHT_LIVE="$CERT_LIVE_DIR/${DOMAIN}"
  local WRONG_ARCHIVE="$CERT_ARCHIVE_DIR/${DOMAIN}-0001"
  local RIGHT_ARCHIVE="$CERT_ARCHIVE_DIR/${DOMAIN}"
  local WRONG_RENEWAL="./certbot/conf/renewal/${DOMAIN}-0001.conf"
  local RIGHT_RENEWAL="./certbot/conf/renewal/${DOMAIN}.conf"

  if [ -d "$WRONG_LIVE" ] && [ ! -d "$RIGHT_LIVE" ]; then
    echo "Fixing cert folder name: ${DOMAIN}-0001 → ${DOMAIN}"
    mv "$WRONG_LIVE"    "$RIGHT_LIVE"
    [ -d "$WRONG_ARCHIVE" ] && mv "$WRONG_ARCHIVE" "$RIGHT_ARCHIVE" || true
    [ -f "$WRONG_RENEWAL" ] && mv "$WRONG_RENEWAL" "$RIGHT_RENEWAL" && \
      sed -i "s/${DOMAIN}-0001/${DOMAIN}/g" "$RIGHT_RENEWAL" || true
    echo "Cert folder renamed successfully."
  else
    echo "Cert folder name is correct — no rename needed."
  fi
}

# ─────────────────────────────────────────────────────────────
# FIX 2: Replace symlinks with real files from archive
# nginx only mounts live/ NOT archive/ so symlinks break
# Also handles ECDSA keys (Let's Encrypt now defaults to ECDSA)
# ─────────────────────────────────────────────────────────────
fix_symlinks_to_real_files() {
  local LIVE_DIR="$CERT_LIVE_DIR/$DOMAIN"
  local ARCH_DIR="$CERT_ARCHIVE_DIR/$DOMAIN"

  echo "Replacing symlinks with real cert files..."

  local LATEST_CERT=$(ls -t "$ARCH_DIR"/cert*.pem      2>/dev/null | head -1)
  local LATEST_CHAIN=$(ls -t "$ARCH_DIR"/chain*.pem    2>/dev/null | head -1)
  local LATEST_FULL=$(ls -t "$ARCH_DIR"/fullchain*.pem 2>/dev/null | head -1)
  local LATEST_KEY=$(ls -t "$ARCH_DIR"/privkey*.pem    2>/dev/null | head -1)

  if [ -z "$LATEST_KEY" ]; then
    echo "ERROR: No archive files found in $ARCH_DIR"
    ls -la "$ARCH_DIR" 2>/dev/null || echo "Archive dir does not exist"
    exit 1
  fi

  cp --remove-destination "$LATEST_CERT"  "$LIVE_DIR/cert.pem"
  cp --remove-destination "$LATEST_CHAIN" "$LIVE_DIR/chain.pem"
  cp --remove-destination "$LATEST_FULL"  "$LIVE_DIR/fullchain.pem"
  cp --remove-destination "$LATEST_KEY"   "$LIVE_DIR/privkey.pem"

  chmod 644 "$LIVE_DIR/cert.pem" "$LIVE_DIR/chain.pem" "$LIVE_DIR/fullchain.pem"
  chmod 600 "$LIVE_DIR/privkey.pem"

  local KEY_SIZE=$(wc -c < "$LIVE_DIR/privkey.pem")
  if [ "$KEY_SIZE" -lt 200 ]; then
    echo "ERROR: privkey.pem is only $KEY_SIZE bytes — broken!"
    exit 1
  fi

  if openssl ec -in "$LIVE_DIR/privkey.pem" -check &>/dev/null; then
    echo "  Key type: ECDSA — valid ✓"
  elif openssl rsa -in "$LIVE_DIR/privkey.pem" -check &>/dev/null; then
    echo "  Key type: RSA — valid ✓"
  else
    echo "ERROR: privkey.pem is not a valid key!"
    openssl ec  -in "$LIVE_DIR/privkey.pem" -check 2>&1 || true
    openssl rsa -in "$LIVE_DIR/privkey.pem" -check 2>&1 || true
    exit 1
  fi

  echo "Real cert files in place — nginx can read them."
}

write_http_only_config() {
  # Write to temp file first then move — prevents truncation bug
  cat > /tmp/nginx_http.conf << 'NGINXEOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
NGINXEOF
  sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /tmp/nginx_http.conf
  mv /tmp/nginx_http.conf ./nginx/conf.d/app.conf
  echo "HTTP-only nginx config written."
  # Verify file is complete
  if ! grep -q "}" ./nginx/conf.d/app.conf; then
    echo "ERROR: nginx config truncated!"
    exit 1
  fi
}

write_https_config() {
  # Write to temp file first then move — prevents truncation bug
  cat > /tmp/nginx_https.conf << 'NGINXEOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name DOMAIN_PLACEHOLDER;

    ssl_certificate     /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    # Supports both ECDSA (Let's Encrypt default) and RSA certs
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;
    client_max_body_size      20M;

    # Docker internal DNS — prevents "host not found in upstream" crash
    # when nginx starts before bun-app container is ready
    resolver 127.0.0.11 valid=10s;
    set $upstream http://APP_CONTAINER_PLACEHOLDER:APP_PORT_PLACEHOLDER;

    location / {
        proxy_pass         $upstream;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

  sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g"             /tmp/nginx_https.conf
  sed -i "s/APP_CONTAINER_PLACEHOLDER/$APP_CONTAINER/g" /tmp/nginx_https.conf
  sed -i "s/APP_PORT_PLACEHOLDER/$APP_PORT/g"           /tmp/nginx_https.conf
  mv /tmp/nginx_https.conf ./nginx/conf.d/app.conf

  echo "HTTPS nginx config written."

  # Verify file is complete and has closing braces
  local BRACE_COUNT=$(grep -c "}" ./nginx/conf.d/app.conf || true)
  if [ "$BRACE_COUNT" -lt 5 ]; then
    echo "ERROR: nginx config looks truncated! Only $BRACE_COUNT closing braces found."
    cat ./nginx/conf.d/app.conf
    exit 1
  fi
  echo "Config verified — $BRACE_COUNT closing braces found ✓"
}

validate_and_reload_nginx() {
  echo "Validating nginx config..."
  if ! docker compose exec nginx nginx -t 2>&1; then
    echo "ERROR: nginx config invalid — dumping config:"
    cat ./nginx/conf.d/app.conf
    exit 1
  fi
  docker compose exec nginx nginx -s reload
  echo "nginx reloaded successfully ✓"
}

# ─────────────────────────────────────────────────────────────
# CASE 1: Certificate already exists → fix + redeploy
# ─────────────────────────────────────────────────────────────
if [ -f "$CERT_PATH" ] || [ -f "$CERT_LIVE_DIR/${DOMAIN}-0001/fullchain.pem" ]; then
  echo "Certificate already exists — running redeploy..."

  fix_cert_folder_name
  fix_symlinks_to_real_files
  write_https_config

  docker compose up -d --build --remove-orphans
  sleep 10
  validate_and_reload_nginx

  echo ""
  echo "Testing SSL..."
  curl -sI https://$DOMAIN | head -3 || echo "WARNING: check — docker logs nginx"
  echo ""
  echo "=== Redeploy complete! ==="
  echo "=== https://$DOMAIN is live ==="
  exit 0
fi

# ─────────────────────────────────────────────────────────────
# CASE 2: First time setup
# ─────────────────────────────────────────────────────────────
echo "No certificate found — starting first-time SSL setup..."

write_http_only_config
docker compose down || true
docker compose up -d --no-deps nginx

echo "Waiting for nginx to be ready..."
sleep 8

if ! docker ps --format '{{.Names}}' | grep -q '^nginx$'; then
  echo "ERROR: nginx failed to start!"
  docker logs nginx --tail 20
  exit 1
fi

curl -sf http://localhost:80 > /dev/null \
  && echo "port 80 OK ✓" \
  || { echo "ERROR: port 80 not responding"; docker logs nginx --tail 20; exit 1; }

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

sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot
sleep 2

if [ ! -f "$CERT_PATH" ] && [ ! -f "$CERT_LIVE_DIR/${DOMAIN}-0001/fullchain.pem" ]; then
  echo "ERROR: Certificate not found after certbot run!"
  ls -la ./certbot/conf/live/ 2>/dev/null || echo "live/ folder does not exist"
  exit 1
fi

echo "Certificate obtained successfully! ✓"

fix_cert_folder_name
fix_symlinks_to_real_files
write_https_config

docker compose down || true

echo "Starting full application stack..."
docker compose up -d --build --remove-orphans

echo "Waiting for all services to be ready..."
sleep 12

validate_and_reload_nginx

echo ""
echo "Testing SSL connection..."
openssl s_client -connect localhost:443 -servername $DOMAIN 2>&1 \
  | grep -E "Cipher|Protocol|subject|Verify" || true

echo ""
curl -sI https://$DOMAIN | head -5 || echo "WARNING: SSL test failed — check: docker logs nginx"

echo ""
echo "=== SSL setup complete! ==="
echo "=== https://$DOMAIN is now live! ==="