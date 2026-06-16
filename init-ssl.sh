#!/bin/bash

DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"         # <-- change to your real email

echo "Starting first-time SSL setup for $DOMAIN..."

# Start nginx in HTTP-only mode
docker compose up -d nginx
sleep 5

# Get certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN

# Reload nginx to activate HTTPS
docker compose exec nginx nginx -s reload

# Start all services
docker compose up -d

echo "SSL setup complete! https://$DOMAIN is now live."