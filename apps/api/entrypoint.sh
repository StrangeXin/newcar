#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
max_retries=30
retry_count=0

until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  retry_count=$((retry_count + 1))
  if [ $retry_count -ge $max_retries ]; then
    echo "PostgreSQL is not available after $max_retries attempts"
    exit 1
  fi
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is up - running migrations"
npx prisma migrate deploy

if [ $? -ne 0 ]; then
  echo "Migration failed"
  exit 1
fi

echo "Migration complete - starting application"
exec node dist/index.js
