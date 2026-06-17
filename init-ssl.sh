set -e
 
DOMAIN="amdaani.v1.amptechnology.in"
EMAIL="devs.amptechnology@gmail.com"
CERT_PATH="./certbot/conf/live/$DOMAIN/fullchain.pem"
 
echo "=== Starting SSL setup for $DOMAIN ==="
 
# Ensure required directories exist
mkdir -p ./nginx/conf.d
mkdir -p ./certbot/www/.well-known/acme-challenge
mkdir -p ./certbot/conf
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot
 
# ─────────────────────────────────────────────────────────────
# CASE 1: Certificate already exists → just redeploy app stack
# ─────────────────────────────────────────────────────────────
if sudo test -f "$CERT_PATH"; then
  echo "Certificate already exists — skipping SSL generation."
  echo "Redeploying updated app stack..."
 
  docker compose up -d --build --remove-orphans
 
  # Give app a moment to start, then reload nginx
  sleep 5
  docker compose exec nginx nginx -s reload || true
 
  echo ""
  echo "=== Redeploy complete! ==="
  echo "=== https://$DOMAIN is live ==="
  exit 0
fi
 
# ─────────────────────────────────────────────────────────────
# CASE 2: First time — generate SSL certificate
# ─────────────────────────────────────────────────────────────
echo "No certificate found — starting first-time SSL setup..."
 
# Write a temporary HTTP-only nginx config for ACME challenge
# (keeps the HTTPS block out so nginx doesn't fail on missing cert files)
cat > ./nginx/conf.d/app.conf << 'NGINXEOF'
server {
    listen 80;
    server_name amdaani.v1.amptechnology.in;
 
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
 
    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
NGINXEOF
 
echo "Temporary HTTP nginx config written."
 
# Tear down any existing containers cleanly
docker compose down || true
 
# Start nginx only (no app, no mongo, no redis yet)
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
curl -sf http://localhost:80 > /dev/null && echo "port 80 OK" || { echo "ERROR: port 80 not responding"; exit 1; }
 
# Request certificate from Let's Encrypt
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
 
# Fix ownership — certbot container runs as root
sudo chown -R ubuntu:ubuntu ./certbot
chmod -R 755 ./certbot
sleep 2
 
# Verify certificate was actually created
if ! sudo test -f "$CERT_PATH"; then
  echo "ERROR: Certificate not found at $CERT_PATH after certbot run!"
  sudo ls -la ./certbot/conf/live/ 2>/dev/null || echo "live/ folder does not exist"
  docker logs nginx
  exit 1
fi
 
echo "Certificate obtained successfully!"
 
# Restore the real HTTPS nginx config from the repo
# (app.conf is committed to git — no generation needed here)
git checkout -- ./nginx/conf.d/app.conf
echo "HTTPS nginx config restored from repo."
 
# Stop the temporary nginx so docker compose up can take over cleanly
docker compose down nginx || true
 
# Start the full stack
echo "Starting full application stack..."
docker compose up -d --build --remove-orphans
 
echo "Waiting for services to be ready..."
sleep 8
 
# Reload nginx with the HTTPS config now that certs exist
docker compose exec nginx nginx -s reload || true
 
echo ""
echo "=== SSL setup complete! ==="
echo "=== https://$DOMAIN is now live! ==="