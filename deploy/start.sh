#!/bin/bash
set -e

# Transform Railway's DATABASE_URL to JDBC format
# Railway provides: postgresql://user:pass@host:port/db
# Spring Boot needs: jdbc:postgresql://host:port/db (with separate PGUSER/PGPASSWORD)
if [[ "$DATABASE_URL" == postgres://* ]] || [[ "$DATABASE_URL" == postgresql://* ]]; then
  export DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's|^postgres(ql)?://[^@]+@|jdbc:postgresql://|')
fi

# Write env vars to a file backend/worker will source
# (supervisord child processes may not inherit all parent env vars)
# Only export vars we actually need — avoids issues with special chars in other vars
{
  echo "export PORT=\"$PORT\""
  echo "export DATABASE_URL=\"$DATABASE_URL\""
  echo "export PGUSER=\"$PGUSER\""
  echo "export PGPASSWORD=\"$PGPASSWORD\""
  echo "export R2_ACCOUNT_ID=\"$R2_ACCOUNT_ID\""
  echo "export R2_ACCESS_KEY_ID=\"$R2_ACCESS_KEY_ID\""
  echo "export R2_SECRET_ACCESS_KEY=\"$R2_SECRET_ACCESS_KEY\""
  echo "export R2_BUCKET_NAME=\"$R2_BUCKET_NAME\""
  echo "export R2_PUBLIC_URL=\"$R2_PUBLIC_URL\""
  echo "export CORS_ALLOWED_ORIGINS=\"$CORS_ALLOWED_ORIGINS\""
} > /app/env.sh

# Start supervisord (manages backend, worker, nginx)
exec supervisord -c /etc/supervisord.conf
