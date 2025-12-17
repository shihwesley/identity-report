# Deployment Guide: Identity Report

This guide explains how to deploy the Identity Report project using Docker and GitHub Actions.

## 🐳 Docker Deployment

The project is containerized using a multi-stage Docker build that serves both the Next.js UI and the MCP SSE server.

### Prerequisites

- Docker installed.
- (Optional) Pinata JWT for cloud sync.

### 1. Build & Run Locally

```bash
# Build the image
docker build -t identity-report .

# Run the container
docker run -p 3000:3000 -p 3001:3001 \
  -e PINATA_JWT="your_jwt_here" \
  identity-report
```

- **UI**: [http://localhost:3000](http://localhost:3000)
- **MCP SSE**: [http://localhost:3001/sse](http://localhost:3001/sse)

---

## 🚀 CI/CD with GitHub Actions

The repository includes two workflows:

1. **Continuous Integration (CI)**: `ci.yml`
   - Runs on every PR/Push to `main`.
   - Lints the code and verifies the build.

2. **Continuous Deployment (CD)**: `deploy.yml`
   - Runs on every Push to `main`.
   - Builds the Docker image and pushes it to **GitHub Container Registry (GHCR)**.
   - Image URI: `ghcr.io/<your-username>/identity-report:latest`

---

## ☁️ Cloud Hosting

### Using Coolify / Railway / Render

1. Connect your GitHub repository.
2. Select **Dockerfile** as the build method.
3. Map the following ports:
   - `3000` -> HTTP (UI)
   - `3001` -> HTTP (MCP Server)
4. Add environment variables:
   - `PINATA_JWT`: Your Pinata token.
   - `VAULT_PATH`: `/app/data` (Ensure you mount a persistent volume here).

### Using Docker Compose

```yaml
services:
  identity-report:
    image: ghcr.io/shihwesley/identity-report:latest
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - PINATA_JWT=${PINATA_JWT}
      - VAULT_PATH=/app/data
    volumes:
      - ./data:/app/data
```
