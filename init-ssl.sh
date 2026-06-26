#!/bin/bash
set -e

DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"
APP_CONTAINER="bun-app"
APP_PORT="8010"
CERT_LIVE_DIR="./certbot/conf/live"
CERT_PATH="$CERT_LIVE_DIR/$DOMAIN/fullchain.pem"

echo "=== Starting SSL setup for $DOMAIN ==="

mkdir -p ./nginx/conf.d
mkdir -p ./certbot/www/.well-known/acme-challenge
mkdir -p ./certbot/conf
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot

# ─────────────────────────────────────────────────────────────
# FIX: Certbot sometimes creates folder with -0001 suffix
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
    # Fix symlink targets inside the renamed live dir
    for FILE in cert.pem chain.pem fullchain.pem privkey.pem; do
      local LINK="$RIGHT_LIVE/$FILE"
      if [ -L "$LINK" ]; then
        local OLD_TARGET=$(readlink "$LINK")
        local NEW_TARGET="${OLD_TARGET//${DOMAIN}-0001/${DOMAIN}}"
        ln -sf "$NEW_TARGET" "$LINK"
      fi
    done
    [ -f "$WRONG_RENEWAL" ] && mv "$WRONG_RENEWAL" "$RIGHT_RENEWAL" || true
    sed -i "s/${DOMAIN}-0001/${DOMAIN}/g" "$RIGHT_RENEWAL" 2>/dev/null || true
    echo "Cert folder renamed successfully."
  else
    echo "Cert folder name is correct — no rename needed."
  fi
}

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

    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;

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
  echo "HTTPS nginx config written."
}

validate_and_reload_nginx() {
  echo "Validating nginx config..."
  if ! docker compose exec nginx nginx -t; then
    echo "ERROR: nginx config invalid."
    exit 1
  fi
  docker compose exec nginx nginx -s reload
  echo "nginx reloaded successfully."
}

# ─────────────────────────────────────────────────────────────
# CASE 1: Certificate already exists → redeploy
# ─────────────────────────────────────────────────────────────
if [ -f "$CERT_PATH" ] || [ -f "$CERT_LIVE_DIR/${DOMAIN}-0001/fullchain.pem" ]; then
  echo "Certificate already exists — running redeploy..."

  fix_cert_folder_name
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
  && echo "port 80 OK" \
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

echo "Certificate obtained successfully!"

fix_cert_folder_name
write_https_config

docker compose down || true

echo "Starting full application stack..."
docker compose up -d --build --remove-orphans

echo "Waiting for services to be ready..."
sleep 8

validate_and_reload_nginx

echo ""
echo "Testing SSL connection..."
curl -sI https://$DOMAIN | head -5 || echo "WARNING: SSL test failed — check: docker logs nginx"

echo ""
echo "=== SSL setup complete! ==="
echo "=== https://$DOMAIN is now live! ==="