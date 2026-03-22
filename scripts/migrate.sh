#!/bin/sh
# Database migration script for production deployment
# Usage: ./scripts/migrate.sh

set -e

DEPLOY_PATH="${DEPLOY_PATH:-/opt/newcar}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"

echo "=== Newcar Database Migration ==="
echo "Deploy path: $DEPLOY_PATH"

# Create backup
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
echo "Creating backup at $BACKUP_FILE..."

docker compose -f "$DEPLOY_PATH/docker-compose.prod.yml" exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  gzip "$BACKUP_FILE"
  echo "Backup created: $BACKUP_FILE.gz"
else
  echo "Backup failed!"
  exit 1
fi

# Run migrations
echo "Running database migrations..."
docker compose -f "$DEPLOY_PATH/docker-compose.prod.yml" exec -T api npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "Migration completed successfully"
else
  echo "Migration failed!"
  exit 1
fi
