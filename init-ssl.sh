#!/bin/bash
set -e
 
DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"
APP_CONTAINER="bun-app"
APP_PORT="8010"
CERT_PATH="./certbot/conf/live/$DOMAIN/fullchain.pem"
 
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
 
    # Cloudflare-compatible SSL — fixes ERR_SSL_VERSION_OR_CIPHER_MISMATCH
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;
 
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
# CASE 1: Certificate already exists → redeploy
# ─────────────────────────────────────────────────────────────
if sudo test -f "$CERT_PATH"; then
  echo "Certificate already exists — running redeploy..."
 
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
 
# Write temporary HTTP-only config for ACME challenge
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
 
echo "Temporary HTTP config written."
 
# Tear down cleanly
docker compose down || true
 
# Start nginx only
docker compose up -d --no-deps nginx
echo "Waiting for nginx to be ready..."
sleep 8
 
# Confirm nginx started
if ! docker ps --format '{{.Names}}' | grep -q '^nginx$'; then
  echo "ERROR: nginx failed to start!"
  docker logs nginx
  exit 1
fi
 
echo "nginx is up — verifying port 80..."
curl -sf http://localhost:80 > /dev/null \
  && echo "port 80 OK" \
  || { echo "ERROR: port 80 not responding"; exit 1; }
 
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
 
# Fix ownership
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot
sleep 2
 
# Verify cert was created
if ! sudo test -f "$CERT_PATH"; then
  echo "ERROR: Certificate not found at $CERT_PATH after certbot run!"
  sudo ls -la ./certbot/conf/live/ 2>/dev/null || echo "live/ folder does not exist"
  docker logs nginx
  exit 1
fi
 
echo "Certificate obtained successfully!"
 
# Write real HTTPS config (embedded — no git checkout needed)
write_https_config
 
# Stop temporary nginx
docker compose down || true
 
# Start full stack
echo "Starting full application stack..."
docker compose up -d --build --remove-orphans
 
echo "Waiting for services to be ready..."
sleep 8
 
# Reload nginx with HTTPS config
validate_and_reload_nginx
 
echo ""
echo "=== SSL setup complete! ==="
echo "=== https://$DOMAIN is now live! ==="