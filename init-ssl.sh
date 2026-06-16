#!/bin/bash

DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"

echo "Starting first-time SSL setup for $DOMAIN..."

# Start ONLY nginx — no dependencies
docker compose up -d --no-deps nginx
sleep 5

# Check nginx is running
if ! docker ps | grep -q nginx; then
  echo "ERROR: nginx failed to start!"
  docker logs nginx
  exit 1
fi

echo "nginx is running, requesting certificate..."

# Get certificate (takes 30-60 seconds)
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN

# Check if cert was obtained
if [ ! -f "./certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "ERROR: Certificate failed!"
  echo "Check DNS: nslookup $DOMAIN"
  exit 1
fi

echo "Certificate obtained successfully!"

# Reload nginx to activate HTTPS
docker compose exec nginx nginx -s reload

# Start all services
docker compose up -d

echo "SSL setup complete! https://$DOMAIN is now live."