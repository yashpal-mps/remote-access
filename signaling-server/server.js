require('dotenv').config({ path: '../.env' });
const WebSocket = require('ws');

const PORT = process.env.SIGNALING_PORT || 3000;
const HOST = process.env.SIGNALING_HOST || '0.0.0.0';

const wss = new WebSocket.Server({ host: HOST, port: PORT });

// Track sessions: Map<sessionId, Set<WebSocket>>
const sessions = new Map();
// Track which session a client belongs to: Map<WebSocket, sessionId>
const clientSessions = new Map();

console.log(`[Signaling Server] Starting on ${HOST}:${PORT}`);
console.log(`[Signaling Server] Environment: ${process.env.NODE_ENV || 'development'}`);

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substring(7);
  console.log(`[Signaling Server] Client connected: ${clientId}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`[Signaling Server] [${clientId}] Received:`, data.type);

      switch (data.type) {
        case 'join':
          handleJoin(ws, data.sessionId, clientId);
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          handleSignalingMessage(ws, data, clientId);
          break;

        case 'disconnect':
          handleDisconnect(ws, clientId);
          break;

        default:
          console.warn(`[Signaling Server] [${clientId}] Unknown message type:`, data.type);
      }
    } catch (error) {
      console.error(`[Signaling Server] [${clientId}] Error processing message:`, error.message);
    }
  });

  ws.on('close', () => {
    console.log(`[Signaling Server] Client disconnected: ${clientId}`);
    handleDisconnect(ws, clientId);
  });

  ws.on('error', (error) => {
    console.error(`[Signaling Server] [${clientId}] WebSocket error:`, error.message);
  });

  // Send acknowledgment
  ws.send(JSON.stringify({ type: 'connected', clientId }));
});

function handleJoin(ws, sessionId, clientId) {
  if (!sessionId) {
    console.warn(`[Signaling Server] [${clientId}] Join rejected: no sessionId`);
    ws.send(JSON.stringify({ type: 'error', message: 'sessionId is required' }));
    return;
  }

  // Leave previous session if any
  if (clientSessions.has(ws)) {
    leaveSession(ws, clientSessions.get(ws));
  }

  // Join new session
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Set());
  }
  sessions.get(sessionId).add(ws);
  clientSessions.set(ws, sessionId);

  console.log(`[Signaling Server] [${clientId}] Joined session: ${sessionId}`);
  ws.send(JSON.stringify({ type: 'joined', sessionId }));
}

function handleSignalingMessage(ws, data, clientId) {
  const sessionId = clientSessions.get(ws);
  if (!sessionId) {
    console.warn(`[Signaling Server] [${clientId}] Not in a session`);
    ws.send(JSON.stringify({ type: 'error', message: 'Not joined to any session' }));
    return;
  }

  const clients = sessions.get(sessionId);
  if (!clients) {
    console.warn(`[Signaling Server] [${clientId}] Session not found: ${sessionId}`);
    return;
  }

  // Broadcast to all other clients in the session
  const message = JSON.stringify(data);
  let sentCount = 0;
  clients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });

  console.log(`[Signaling Server] [${clientId}] Broadcast ${data.type} to ${sentCount} client(s)`);
}

function handleDisconnect(ws, clientId) {
  const sessionId = clientSessions.get(ws);
  if (sessionId) {
    leaveSession(ws, sessionId);
  }
  clientSessions.delete(ws);
}

function leaveSession(ws, sessionId) {
  const clients = sessions.get(sessionId);
  if (clients) {
    clients.delete(ws);
    console.log(`[Signaling Server] Client left session: ${sessionId} (${clients.size} remaining)`);
    
    // Clean up empty sessions
    if (clients.size === 0) {
      sessions.delete(sessionId);
      console.log(`[Signaling Server] Session removed: ${sessionId}`);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Signaling Server] SIGTERM received, shutting down...');
  wss.close(() => {
    console.log('[Signaling Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Signaling Server] SIGINT received, shutting down...');
  wss.close(() => {
    console.log('[Signaling Server] Server closed');
    process.exit(0);
  });
});

console.log(`[Signaling Server] Ready and waiting for connections...`);
