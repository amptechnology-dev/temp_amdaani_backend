#!/bin/bash

DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"

echo "=== Starting SSL setup for $DOMAIN ==="

# Step 1 — Write HTTP only nginx config
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

# Step 2 — Create required folders
mkdir -p ./certbot/www ./certbot/conf

# Step 3 — Start only nginx (no app, no mongo, no redis)
docker compose up -d --no-deps nginx
sleep 8

# Step 4 — Check nginx running
if ! docker ps | grep -q nginx; then
  echo "ERROR: nginx failed to start!"
  docker logs nginx
  exit 1
fi

echo "nginx running — getting certificate..."

# Step 5 — Get SSL certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN

# Step 6 — Check cert was obtained
if [ ! -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "ERROR: Certificate failed! Check DNS."
  docker logs nginx
  exit 1
fi

echo "Certificate obtained!"

# Step 7 — Write full HTTPS nginx config
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

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    location / {
        proxy_pass http://app:8010;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90;
    }
}
NGINXEOF

echo "HTTPS nginx config written"

# Step 8 — Reload nginx with SSL config
docker compose exec nginx nginx -s reload

# Step 9 — Start all services
docker compose up -d

echo ""
echo "=== SSL setup complete! ==="
echo "=== https://$DOMAIN is now live! ==="