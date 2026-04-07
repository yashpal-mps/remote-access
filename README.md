# Capture It - Remote Desktop

Production-grade macOS-to-macOS remote desktop application built with Electron, React, WebRTC, and WebSocket signaling.

## Features

- **Host Mode**: Share your screen and allow remote control
- **Client Mode**: View and control remote desktop in real-time
- **Low Latency**: Optimized WebRTC data channels (< 100ms target)
- **Host Approval**: Host must explicitly grant control access
- **Full Input Control**: Mouse movement, clicks, scroll, and keyboard input
- **Auto-Reconnect**: Automatic reconnection with exponential backoff
- **No Authentication**: Direct session ID connection (as specified)

## Tech Stack

- **Electron**: Desktop application framework
- **React 18**: UI framework
- **WebRTC**: Real-time video streaming and data channels
- **WebSocket**: Signaling server for WebRTC handshake
- **Docker**: Containerized signaling server
- **robotjs**: OS-level input control (mouse, keyboard)
- **Vite**: Fast build tool for React

## Prerequisites

- **macOS** (required for robotjs and screen capture)
- **Node.js** 18+ 
- **npm** or **yarn**
- **Docker** (for signaling server)

## Project Structure

```
root/
├── .env                          # Environment configuration
├── package.json                  # Root package with scripts
├── electron/
│   ├── main.js                   # Electron main process
│   └── preload.js                # Context bridge API
├── renderer/
│   ├── package.json              # React app dependencies
│   ├── vite.config.js            # Vite configuration
│   ├── index.html                # HTML entry point
│   └── src/
│       ├── main.jsx              # React entry point
│       ├── App.jsx               # Main app component
│       ├── Host.jsx              # Host mode component
│       ├── Client.jsx            # Client mode component
│       └── styles.css            # Global styles
├── signaling-server/
│   ├── package.json              # Signaling server dependencies
│   ├── server.js                 # WebSocket signaling server
│   ├── Dockerfile                # Docker image definition
│   └── docker-compose.yml        # Docker compose configuration
└── README.md                     # This file
```

## Installation

### 1. Clone or navigate to project directory

```bash
cd capture-it
```

### 2. Install all dependencies

```bash
npm run install:all
```

Or install manually:

```bash
# Root dependencies
npm install

# Renderer dependencies
cd renderer && npm install && cd ..

# Signaling server dependencies
cd signaling-server && npm install && cd ..
```

## Configuration

All configuration is managed through the `.env` file at the project root. Key variables:

```env
# Signaling Server
SIGNALING_PORT=3000
SIGNALING_URL=ws://localhost:3000

# STUN Servers
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# WebRTC
WEBRTC_MAX_FPS=60
WEBRTC_MAX_BITRATE_KBPS=8000
WEBRTC_MIN_BITRATE_KBPS=500

# TURN Server (optional)
TURN_SERVER_IP=127.0.0.1
TURN_PORT=3478
TURN_USERNAME=turnuser
TURN_PASSWORD=turnpassword123
```

## Running the Application

### Step 1: Start Signaling Server (Docker)

```bash
npm run docker:up
```

Or manually:

```bash
cd signaling-server
docker-compose up -d
```

To stop:

```bash
npm run docker:down
```

### Step 2: Start Development Mode

```bash
npm run dev
```

This will:
- Start Vite dev server on port 5173
- Launch Electron app automatically
- Connect to signaling server

### Step 3: Run Electron Only (if Vite is already running)

```bash
npm run electron
```

### Step 4: Run Signaling Server Locally (without Docker)

```bash
npm run signaling
```

## Usage

### Host Side

1. Launch the app
2. Click **"Start Hosting"**
3. Share the generated **Session ID** with the client
4. Click **"Grant Access"** to allow remote control
5. Screen streaming starts automatically when client connects

### Client Side

1. Launch the app
2. Click **"Connect to Host"**
3. Enter the **Session ID** provided by the host
4. Click **"Connect"**
5. Wait for connection to establish
6. Move mouse, click, type - all inputs are sent to host

## macOS Permissions

This app requires two macOS permissions to function properly:

### 1. Screen Recording Permission

**Required for**: Screen capture using `desktopCapturer`

**How to grant**:
1. Open **System Preferences** → **Security & Privacy** → **Privacy** tab
2. Select **Screen Recording** from the left sidebar
3. Click the lock icon and enter your password
4. Check the box next to **Capture It** (or Electron)
5. Restart the app

### 2. Accessibility Permission

**Required for**: robotjs input control (mouse, keyboard)

**How to grant**:
1. Open **System Preferences** → **Security & Privacy** → **Privacy** tab
2. Select **Accessibility** from the left sidebar
3. Click the lock icon and enter your password
4. Check the box next to **Capture It** (or Electron)
5. Restart the app

**Note**: macOS will prompt for these permissions on first use. Grant them when prompted.

## WebRTC Configuration

### Video Stream
- **Resolution**: 720p (1280x720)
- **Frame Rate**: 30 FPS (configurable up to 60 FPS)
- **Codec**: VP8/H.264 (browser default)

### Data Channel
- **Ordered**: false (low latency)
- **Max Retransmits**: 0 (fire-and-forget)
- **Protocol**: JSON messages

### Input Event Format

```javascript
// Mouse movement
{ type: 'mousemove', x: 0.5, y: 0.3 }

// Mouse click
{ type: 'mousedown', button: 'left' }
{ type: 'mouseup', button: 'left' }

// Scroll
{ type: 'scroll', deltaY: -100 }

// Keyboard
{ type: 'keydown', key: 'a', code: 'KeyA', modifiers: ['shift'] }
{ type: 'keyup', key: 'a', code: 'KeyA' }
```

## Available Scripts

```bash
# Install all dependencies
npm run install:all

# Start development mode (Vite + Electron)
npm run dev

# Start Vite dev server only
npm run dev:renderer

# Start Electron only
npm run dev:electron
npm run electron

# Start signaling server locally
npm run signaling

# Start signaling server with Docker
npm run docker:up

# Stop Docker signaling server
npm run docker:down

# Build React app for production
npm run build
```

## Architecture

### Signaling Flow

1. **Host** generates session ID and connects to signaling server
2. **Host** joins session with ID
3. **Client** enters session ID and connects to signaling server
4. **Client** joins same session
5. **Client** creates WebRTC offer and sends via signaling
6. **Host** receives offer, creates answer, sends back
7. **ICE candidates** exchanged bidirectionally
8. **WebRTC connection** established
9. **Video stream** flows from host to client
10. **Input events** flow from client to host via DataChannel

### Connection States

- **disconnected**: No active connection
- **connecting**: Attempting to establish connection
- **connected**: WebRTC connection active

### Auto-Reconnect

- WebSocket signaling auto-reconnects on disconnect
- Exponential backoff: 1s, 2s, 4s, 8s, max 10s
- WebRTC does not auto-reconnect (requires new session)

## Troubleshooting

### Screen capture shows black screen
- Grant Screen Recording permission in System Preferences
- Restart the app after granting permission
- Check if macOS version is compatible (10.15+)

### Mouse/keyboard not working on host
- Grant Accessibility permission in System Preferences
- Restart the app after granting permission
- Check if host has approved client access

### Connection fails
- Verify signaling server is running: `docker ps`
- Check SIGNALING_URL in .env matches your setup
- Check firewall settings (port 3000)
- Review console logs for WebRTC errors

### Video is laggy
- Reduce WEBRTC_MAX_FPS in .env (try 24 or 30)
- Check network bandwidth between machines
- Verify both Macs are on same network (or configure TURN)

## Performance

- **Target Latency**: < 100ms
- **Video Quality**: 720p @ 30fps
- **Input Throttling**: Mouse moves limited to 60fps via requestAnimationFrame
- **Data Channel**: Unordered, no retransmits for minimum latency

## Security Notes

⚠️ **This application has NO authentication or encryption beyond WebRTC's built-in DTLS.**

- Session IDs are randomly generated but not encrypted
- No user authentication required
- Anyone with session ID can connect (if host approves)
- Designed for trusted local network use only

## License

MIT

## Support

For issues or questions, please check:
- Console logs in Electron DevTools
- Docker logs: `docker logs capture-it-signaling`
- macOS permission settings
