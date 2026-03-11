#!/bin/bash
set -e

# Transform Railway's DATABASE_URL to JDBC format
# Railway provides: postgresql://user:pass@host:port/db
# Spring Boot needs: jdbc:postgresql://host:port/db (with separate PGUSER/PGPASSWORD)
if [[ "$DATABASE_URL" == postgres://* ]] || [[ "$DATABASE_URL" == postgresql://* ]]; then
  export DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's|^postgres(ql)?://[^@]+@|jdbc:postgresql://|')
fi

# Start supervisord (manages backend, worker, nginx)
exec supervisord -c /etc/supervisord.conf
