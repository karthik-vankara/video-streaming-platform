#!/bin/bash
set -e

# Replace RAILWAY_PORT in nginx config with actual PORT value
LISTEN_PORT="${PORT:-3000}"
sed -i "s/RAILWAY_PORT/$LISTEN_PORT/g" /etc/nginx/http.d/default.conf

# Transform Railway's DATABASE_URL to JDBC format
# Railway provides: postgresql://user:pass@host:port/db
# Spring Boot needs: jdbc:postgresql://host:port/db (with separate PGUSER/PGPASSWORD)
if [[ "$DATABASE_URL" == postgres://* ]] || [[ "$DATABASE_URL" == postgresql://* ]]; then
  export DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's|^postgres(ql)?://[^@]+@|jdbc:postgresql://|')
fi

# Start supervisord (manages backend, worker, nginx)
exec supervisord -c /etc/supervisord.conf
