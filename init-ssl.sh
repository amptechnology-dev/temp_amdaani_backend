#!/bin/bash

DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"

echo "=== Starting SSL setup for $DOMAIN ==="

# Create ALL required folders first
mkdir -p ./nginx/conf.d
mkdir -p ./certbot/www/.well-known/acme-challenge
mkdir -p ./certbot/conf
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot

# Step 1 — Write temporary HTTP-only config for certbot challenge
cat > ./nginx/conf.d/app.conf << 'NGINXEOF'
server {
    listen 80;
    server_name amdaani.v1.amptechnology.in;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
NGINXEOF

echo "HTTP nginx config written"

# Step 2 — Stop any running containers cleanly
docker compose down

# Step 3 — Start nginx only
docker compose up -d --no-deps nginx
sleep 8

# Step 4 — Verify nginx is running and serving port 80
if ! docker ps | grep -q nginx; then
  echo "ERROR: nginx failed to start!"
  docker logs nginx
  exit 1
fi

echo "nginx is up — testing port 80..."
curl -s http://localhost:80 > /dev/null
echo "port 80 OK"

# Step 5 — Get certificate only if not already obtained
if [ ! -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "No cert found — requesting from Let's Encrypt..."
  docker run --rm \
    -v $(pwd)/certbot/www:/var/www/certbot \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

  if [ ! -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "ERROR: Certificate failed!"
    docker logs nginx
    exit 1
  fi
  echo "Certificate obtained!"
else
  echo "Certificate already exists — skipping."
fi

# Step 6 — Restore your real nginx config from repo
git checkout -- ./nginx/conf.d/app.conf
echo "HTTPS nginx config restored from repo"

# Step 7 — Start all services and rebuild app
docker compose up -d --build --remove-orphans
sleep 5

# Step 8 — Reload nginx with full HTTPS config
docker compose exec nginx nginx -s reload

echo ""
echo "=== SSL setup complete! ==="
echo "=== https://$DOMAIN is now live! ==="