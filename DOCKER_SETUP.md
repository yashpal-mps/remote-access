# 🐳 Docker Setup Guide - Capture It

## ✅ Docker Desktop Installation

**Status**: ✅ Docker Desktop is installed (v29.3.1)  
**Current State**: ⏳ Starting up (first launch takes 30-60 seconds)

---

## 🚀 STEP-BY-STEP DOCKER SETUP

### Step 1: Wait for Docker Desktop to Fully Start

**What to look for:**
- Docker Desktop window shows "Docker Desktop is running"
- System tray shows green whale icon (not animated)
- No more "Starting..." messages

**Typical startup time:**
- First launch: 30-60 seconds
- Subsequent launches: 10-20 seconds

---

### Step 2: Verify Docker is Running

Open PowerShell and run:

```powershell
docker version
```

**Expected output:**
```
Client:
 Version:           29.3.1
 ...

Server: Docker Desktop ...
 Engine:
  Version:          ...
  API version:      ...
```

If you see both Client AND Server sections, Docker is ready! ✅

---

### Step 3: Build and Start Signaling Server

```powershell
cd c:\Users\Paddy-No\Desktop\capture-it\signaling-server
docker-compose up -d
```

**What this does:**
- `docker-compose up`: Starts the container
- `-d`: Runs in detached mode (background)
- Builds the Docker image from Dockerfile
- Starts the signaling server on port 3000

---

### Step 4: Verify Container is Running

```powershell
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE                          STATUS          PORTS                    NAMES
abc123def456   signaling-server-signaling     Up 10 seconds   0.0.0.0:3000->3000/tcp   capture-it-signaling
```

---

### Step 5: Check Logs

```powershell
docker logs capture-it-signaling
```

**Expected output:**
```
[Signaling Server] Starting on 0.0.0.0:3000
[Signaling Server] Environment: development
[Signaling Server] Ready and waiting for connections...
```

---

## 🔧 Docker Commands Reference

### Start Signaling Server
```powershell
cd c:\Users\Paddy-No\Desktop\capture-it\signaling-server
docker-compose up -d
```

### Stop Signaling Server
```powershell
docker-compose down
```

### View Logs (Real-time)
```powershell
docker logs -f capture-it-signaling
```

### View Logs (Last 50 lines)
```powershell
docker logs --tail 50 capture-it-signaling
```

### Restart Container
```powershell
docker-compose restart
```

### Rebuild Container
```powershell
docker-compose up -d --build
```

### Remove Container
```powershell
docker-compose down -v
```

### Check Container Status
```powershell
docker ps -a
```

---

## 📊 Docker Configuration

### Current Setup (docker-compose.yml):

```yaml
version: '3.8'

services:
  signaling-server:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: capture-it-signaling
    ports:
      - "3000:3000"
    env_file:
      - ../.env
    environment:
      - SIGNALING_PORT=3000
      - SIGNALING_HOST=0.0.0.0
      - NODE_ENV=development
    restart: unless-stopped
    networks:
      - capture-it-network

networks:
  capture-it-network:
    driver: bridge
```

### What This Means:

- **Port Mapping**: Host port 3000 → Container port 3000
- **Environment**: Loads from `.env` file
- **Restart Policy**: Auto-restart unless manually stopped
- **Network**: Isolated bridge network

---

## 🗄️ Data Storage

### Important: Signaling Server is Stateless

**No persistent storage needed because:**
- ❌ No database
- ❌ No file storage
- ❌ No user data
- ✅ Connections managed in memory
- ✅ Sessions cleared on restart

**If container restarts:**
- All active sessions are lost
- Clients automatically reconnect
- New sessions created
- No data loss (nothing to persist)

---

## 🔍 Troubleshooting

### Issue: "Cannot connect to Docker daemon"

**Solution:**
```powershell
# Check if Docker Desktop is running
Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue

# If not running, start it:
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# Wait 30-60 seconds, then try again
```

---

### Issue: "Port 3000 already in use"

**Solution:**
```powershell
# Find process using port 3000
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess

# Stop the process (replace PID with actual process ID)
Stop-Process -Id <PID> -Force

# Or change the port in docker-compose.yml:
# ports:
#   - "3001:3000"  # Use port 3001 instead
```

---

### Issue: Container won't start

**Solution:**
```powershell
# Check logs for errors
docker logs capture-it-signaling

# Rebuild container
docker-compose down
docker-compose up -d --build

# Check container status
docker ps -a
```

---

### Issue: Can't connect to signaling server

**Solution:**
```powershell
# Verify container is running
docker ps

# Check if port 3000 is listening
netstat -ano | findstr :3000

# Test WebSocket connection
# Use a WebSocket client or browser extension to connect to ws://localhost:3000
```

---

## 🎯 Production Docker Setup

### For Production Deployment:

**1. Update docker-compose.yml:**

```yaml
version: '3.8'

services:
  signaling-server:
    image: capture-it/signaling-server:latest
    container_name: capture-it-signaling
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SIGNALING_PORT=3000
      - SIGNALING_HOST=0.0.0.0
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - capture-it-network

networks:
  capture-it-network:
    driver: bridge
```

**2. Build and push to registry:**

```powershell
# Build image
docker build -t capture-it/signaling-server:latest .

# Tag for registry
docker tag capture-it/signaling-server:latest your-registry/capture-it/signaling-server:latest

# Push to registry
docker push your-registry/capture-it/signaling-server:latest
```

---

## 📋 Quick Start Commands

### Complete Setup (Copy & Paste):

```powershell
# 1. Navigate to signaling server folder
cd c:\Users\Paddy-No\Desktop\capture-it\signaling-server

# 2. Start container
docker-compose up -d

# 3. Verify it's running
docker ps

# 4. Check logs
docker logs capture-it-signaling

# 5. Test connection (should show container running)
curl http://localhost:3000
```

---

## 🎓 Docker Benefits

### Why Use Docker?

✅ **Consistency**: Same environment everywhere  
✅ **Isolation**: Doesn't affect your system  
✅ **Portability**: Easy to deploy to any server  
✅ **Auto-restart**: Recovers from crashes  
✅ **Clean**: Easy to remove completely  
✅ **Version control**: Image versioning  

### vs Node.js Direct:

| Feature | Docker | Node.js Direct |
|---------|--------|----------------|
| Setup | One command | Install dependencies |
| Portability | ✅ Excellent | ❌ System-dependent |
| Auto-restart | ✅ Built-in | ❌ Manual |
| Isolation | ✅ Complete | ❌ None |
| Cleanup | ✅ One command | ❌ Manual |
| Resources | ⚠️ Slightly higher | ✅ Minimal |

---

## 🎉 Next Steps

Once Docker is running:

1. ✅ Verify signaling server works
2. ✅ Test with Electron app
3. ✅ Update `.env` SIGNALING_URL if needed
4. ✅ Configure firewall for port 3000
5. ✅ Ready for production!

---

**Docker Setup Status**: ⏳ In Progress  
**Next**: Wait for Docker Desktop to finish starting, then run `docker-compose up -d`

🐳 **Docker will provide a robust, production-ready signaling server!** 🐳
