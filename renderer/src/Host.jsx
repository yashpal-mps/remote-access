import React, { useState, useRef, useEffect, useCallback } from 'react';

function Host({ onBack }) {
  const [sessionId, setSessionId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [error, setError] = useState('');
  const [config, setConfig] = useState(null);

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const signalingWsRef = useRef(null);
  const localStreamRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await window.electronAPI.getConfig();
        setConfig(cfg);
        console.log('[Host] Config loaded:', cfg);
      } catch (err) {
        console.error('[Host] Failed to load config:', err);
        setError('Failed to load configuration');
      }
    };
    loadConfig();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    console.log('[Host] Cleaning up resources');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (signalingWsRef.current) {
      signalingWsRef.current.close();
      signalingWsRef.current = null;
    }
  }, []);

  const handleStartHosting = async () => {
    try {
      setError('');
      setConnectionStatus('connecting');

      // Get session ID and config from main process
      const result = await window.electronAPI.startHost();
      setSessionId(result.sessionId);
      console.log('[Host] Session ID generated:', result.sessionId);

      // Initialize WebRTC
      await setupPeerConnection();

      // Connect to signaling server
      connectToSignaling(result.sessionId);

      setConnectionStatus('connected');
      console.log('[Host] Hosting started successfully');
    } catch (err) {
      console.error('[Host] Failed to start hosting:', err);
      setError('Failed to start hosting: ' + err.message);
      setConnectionStatus('disconnected');
    }
  };

  const setupPeerConnection = async () => {
    if (!config) {
      throw new Error('Config not loaded');
    }

    const iceServers = [...config.stunServers.map((url) => ({ urls: url }))];
    if (config.turnConfig) {
      iceServers.push(config.turnConfig);
    }

    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    });

    peerConnectionRef.current = pc;

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[Host] ICE candidate generated');
        sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[Host] Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection lost');
      }
    };

    // Handle incoming data channel (client creates offer with data channel)
    pc.ondatachannel = (event) => {
      console.log('[Host] Data channel received');
      const channel = event.channel;
      dataChannelRef.current = channel;

      channel.onopen = () => {
        console.log('[Host] Data channel opened');
      };

      channel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Host] Received input:', data.type);

          // Only process input if approved
          if (isApproved) {
            executeInput(data);
          } else {
            console.log('[Host] Input ignored - not approved');
          }
        } catch (err) {
          console.error('[Host] Error processing input:', err);
        }
      };

      channel.onerror = (error) => {
        console.error('[Host] Data channel error:', error);
      };

      channel.onclose = () => {
        console.log('[Host] Data channel closed');
        dataChannelRef.current = null;
      };
    };

    console.log('[Host] Peer connection created');
  };

  const executeInput = async (data) => {
    try {
      await window.electronAPI.executeInput(data);
    } catch (err) {
      console.error('[Host] Failed to execute input:', err);
    }
  };

  const connectToSignaling = (sessionId) => {
    if (!config) return;

    const wsUrl = config.signalingUrl;
    console.log('[Host] Connecting to signaling server:', wsUrl);

    const ws = new WebSocket(wsUrl);
    signalingWsRef.current = ws;

    ws.onopen = () => {
      console.log('[Host] Connected to signaling server');
      reconnectAttemptsRef.current = 0;

      // Join session
      ws.send(
        JSON.stringify({
          type: 'join',
          sessionId,
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[Host] Signaling message received:', message.type);

        switch (message.type) {
          case 'joined':
            console.log('[Host] Joined session:', message.sessionId);
            break;

          case 'offer':
            await handleOffer(message);
            break;

          case 'ice-candidate':
            if (peerConnectionRef.current && message.candidate) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
              console.log('[Host] ICE candidate added');
            }
            break;

          case 'error':
            console.error('[Host] Signaling error:', message.message);
            setError(message.message);
            break;

          default:
            console.log('[Host] Unknown signaling message:', message.type);
        }
      } catch (err) {
        console.error('[Host] Error processing signaling message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[Host] Signaling connection closed');
      signalingWsRef.current = null;

      // Auto-reconnect with exponential backoff
      if (sessionId) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        console.log(`[Host] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connectToSignaling(sessionId);
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[Host] Signaling error:', error);
    };
  };

  const handleOffer = async (message) => {
    try {
      console.log('[Host] Handling offer');
      const pc = peerConnectionRef.current;

      if (!pc) {
        console.error('[Host] No peer connection');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(message.offer));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer
      sendSignalingMessage({
        type: 'answer',
        answer: pc.localDescription,
      });

      console.log('[Host] Answer sent');

      // Start screen capture after setting up peer connection
      await startScreenCapture();
    } catch (err) {
      console.error('[Host] Error handling offer:', err);
      setError('Failed to handle connection offer: ' + err.message);
    }
  };

  const startScreenCapture = async () => {
    try {
      console.log('[Host] Starting screen capture');

      const sources = await window.electronAPI.getScreenSources();
      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      const source = sources[0];
      console.log('[Host] Selected screen:', source.name);

      const maxFps = config?.maxFps || 30;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            minWidth: 1280,
            maxWidth: 1280,
            minHeight: 720,
            maxHeight: 720,
            maxFrameRate: maxFps,
          },
        },
      });

      localStreamRef.current = stream;

      // Add tracks to peer connection
      const pc = peerConnectionRef.current;
      if (pc) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
          console.log('[Host] Track added to peer connection');
        });
      }

      setIsStreaming(true);
      console.log('[Host] Screen capture started');
    } catch (err) {
      console.error('[Host] Failed to start screen capture:', err);
      setError('Failed to capture screen: ' + err.message);
    }
  };

  const sendSignalingMessage = (message) => {
    if (signalingWsRef.current && signalingWsRef.current.readyState === WebSocket.OPEN) {
      signalingWsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[Host] Signaling not connected');
    }
  };

  const handleApproval = () => {
    setIsApproved(!isApproved);
    console.log('[Host] Approval toggled:', !isApproved);
  };

  const handleStopHosting = () => {
    cleanup();
    setSessionId('');
    setIsStreaming(false);
    setIsApproved(false);
    setConnectionStatus('disconnected');
    setError('');
    onBack();
  };

  return (
    <div className="host-screen">
      <div className="header">
        <h1>Host Mode</h1>
        <div className="header-controls">
          <div className={`connection-status ${connectionStatus}`}>
            <span className="status-dot"></span>
            <span>{connectionStatus.toUpperCase()}</span>
          </div>
          <button className="btn btn-secondary" onClick={handleStopHosting}>
            Back
          </button>
        </div>
      </div>

      {!sessionId ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={handleStartHosting} style={{ padding: '20px 40px', fontSize: '18px' }}>
            Start Hosting
          </button>
        </div>
      ) : (
        <>
          <div className="session-id-container">
            <div className="session-id-label">Session ID (share with client)</div>
            <div className="session-id">{sessionId}</div>
            <p className="info-text">Enter this code on the client to connect</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="approval-container">
            <div>
              <div className="approval-status">Client Control</div>
              <p className="info-text">
                {isApproved ? 'Client has control' : 'Client control disabled'}
              </p>
            </div>
            <button
              className={`btn ${isApproved ? 'btn-danger' : 'btn-success'}`}
              onClick={handleApproval}
            >
              {isApproved ? 'Revoke Access' : 'Grant Access'}
            </button>
          </div>

          <div className="controls-container">
            <div
              className={`connection-status ${isStreaming ? 'connected' : 'disconnected'}`}
              style={{ padding: '12px 20px' }}
            >
              <span className="status-dot"></span>
              <span>{isStreaming ? 'STREAMING' : 'NOT STREAMING'}</span>
            </div>
          </div>

          <div style={{ marginTop: 'auto', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '12px' }}>macOS Permissions Required</h3>
            <p className="info-text" style={{ marginBottom: '8px' }}>
              • Screen Recording: System Preferences → Security & Privacy → Screen Recording
            </p>
            <p className="info-text">
              • Accessibility: System Preferences → Security & Privacy → Accessibility (for robotjs)
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default Host;
