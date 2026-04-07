# Capture It - Quick Reference Card

## 🚀 Start the App

```bash
# 1. Start signaling server
npm run docker:up

# 2. Start the app
npm run dev
```

## 📱 How to Use

### HOST (share your screen):
1. Click "Start Hosting"
2. Share Session ID with client
3. Click "Grant Access" when ready

### CLIENT (control remote):
1. Click "Connect to Host"
2. Enter Session ID
3. Click "Connect"
4. Control the remote desktop

## 🔑 Session ID Example
```
A7K9M2X
```

## ⚙️ Configuration

Edit `.env` file to change:
- `SIGNALING_PORT` - WebSocket port (default: 3000)
- `WEBRTC_MAX_FPS` - Video frame rate (default: 60)
- `STUN_SERVERS` - STUN server list

## 🍎 macOS Permissions

Required on HOST machine:
1. **Screen Recording** - System Preferences → Security & Privacy
2. **Accessibility** - System Preferences → Security & Privacy

Restart app after granting permissions!

## 🐛 Quick Troubleshooting

**Can't connect?**
```bash
# Check signaling server
docker ps

# View logs
docker logs capture-it-signaling

# Restart server
npm run docker:down
npm run docker:up
```

**Black screen?** → Grant Screen Recording permission

**Mouse/keyboard not working?** → Grant Accessibility permission

**Connection drops?** → Check network, verify both Macs on same network

## 📊 Port Requirements

- **3000** - Signaling server (WebSocket)
- **5173** - Vite dev server (development only)

## 🎯 Performance

- **Resolution**: 720p
- **Frame Rate**: 30 FPS
- **Target Latency**: <100ms
- **Data Channel**: Unordered, no retransmits

## 📝 Useful Commands

```bash
# Install dependencies
npm run install:all

# Development
npm run dev              # Start everything
npm run electron         # Electron only
npm run signaling        # Signaling server only

# Docker
npm run docker:up        # Start signaling
npm run docker:down      # Stop signaling

# Build
npm run build            # Production build
```

## 🔍 Debug Mode

Open Electron DevTools: `View → Toggle Developer Tools`

Check console logs for:
- `[Host]` - Host component logs
- `[Client]` - Client component logs
- `[Electron Main]` - Main process logs
- `[Signaling Server]` - WebSocket server logs

---

**Need Help?** See README.md for complete documentation
