# =============================================================================
# All-in-one Dockerfile for Railway deployment
# Builds backend, worker, and frontend into a single container
# Uses supervisord to run all processes
# =============================================================================

# ── Stage 1: Build backend JAR ──
FROM eclipse-temurin:21-jdk-alpine AS backend-build
WORKDIR /app
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
COPY backend/src src
RUN chmod +x mvnw && ./mvnw -DskipTests clean package -B

# ── Stage 2: Build worker JAR ──
FROM eclipse-temurin:21-jdk-alpine AS worker-build
WORKDIR /app
COPY worker/.mvn .mvn
COPY worker/mvnw worker/pom.xml ./
COPY worker/src src
RUN chmod +x mvnw && ./mvnw -DskipTests clean package -B

# ── Stage 3: Build frontend static files ──
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 4: Final runtime image ──
FROM eclipse-temurin:21-jre-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    nginx \
    ffmpeg \
    supervisor \
    curl \
    bash

# Create directories
RUN mkdir -p /app/backend /app/worker /var/log/supervisor /run/nginx

# Copy backend JAR
COPY --from=backend-build /app/target/*.jar /app/backend/app.jar

# Copy worker JAR
COPY --from=worker-build /app/target/*.jar /app/worker/app.jar

# Copy frontend static files
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy nginx config (for single-container: proxy to localhost:8080)
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf

# Copy supervisord config
COPY deploy/supervisord.conf /etc/supervisord.conf

# Copy start script
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Nginx on 3000, backend on 8080, worker on 8081
EXPOSE 3000

CMD ["/app/start.sh"]
