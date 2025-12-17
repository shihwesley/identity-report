# Deployment Guide: Identity Report

Identity Report is containerized and ready for cloud hosting. This guide focuses on **Railway**, using a professional **Multi-Service** architecture.

## 🚂 Railway Deployment (Multi-Service)

To ensure both the Next.js UI and the MCP SSE Server are independently accessible and scalable, we recommend deploying them as two separate services in one Railway project.

### 1. The Web UI Service (Frontend)

1. **New Project**: Select your `identity-report` repo.
2. **Settings**: Ensure the **Start Command** is `npm run start`.
3. **Port**: Set to `3000`.
4. **Variables**: Add your `PINATA_JWT`.

### 2. The MCP Server (Backend)

1. **Add Service**: click **"New"** > **"GitHub Repo"** > Select the same `identity-report` repo again.
2. **Settings**:
   - Change the **Service Name** to `identity-report-mcp`.
   - Override the **Start Command** to: `npm run start:mcp`.
3. **Networking**:
   - Set the **Port** to `3001`.
   - Click **"Generate Domain"** to get a public URL for your MCP server.
4. **Variables**:
   - `MCP_TRANSPORT`: `sse`
   - `VAULT_PATH`: `/app/data` (Ensure you mount a volume here).

### 3. Persistent Storage (Vault)

For the **MCP Server** service:

1. Go to **Variables** > **Volumes** (or the side menu).
2. Click **"New Volume"** and mount it to `/app/data`.
3. This stores your user profile, memories, and identity metadata securely across restarts.

---

## 🛠️ Configuration Details

| Service | Start Command | Port | URL Path |
| :--- | :--- | :--- | :--- |
| **UI** | `npm run start` | 3000 | `/` |
| **MCP** | `npm run start:mcp` | 3001 | `/sse` |

---

## 🏁 Connecting Your AI

Once your MCP server domain is generated (e.g., `mcp-production.up.railway.app`), you can add it to Claude Desktop or any MCP client:

```json
{
  "mcpServers": {
    "identity-report": {
      "command": "npx",
      "args": ["@modelcontextprotocol/client-sse", "https://your-mcp-url.up.railway.app/sse"]
    }
  }
}
```

## 🐳 Running Everything Locally (Docker Compose)

If you prefer running both together on one machine, use the root `Dockerfile` or the provided `entrypoint.sh`.

```bash
docker build -t identity-report .
docker run -p 3000:3000 -p 3001:3001 identity-report
```
