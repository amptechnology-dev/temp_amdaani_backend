#!/bin/bash

DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"

echo "=== Starting SSL setup for $DOMAIN ==="

# Create required folders
mkdir -p ./certbot/www/.well-known/acme-challenge ./certbot/conf
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot

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

# Step 2 — Start nginx only
docker compose up -d --no-deps nginx
sleep 5

# Step 3 — Get certificate only if not already obtained
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

# Step 4 — Write full HTTPS nginx config
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

# Step 5 — Start all services
docker compose up -d --build --remove-orphans

# Step 6 — Reload nginx
sleep 5
docker compose exec nginx nginx -s reload

echo ""
echo "=== SSL setup complete! ==="
echo "=== https://$DOMAIN is now live! ==="