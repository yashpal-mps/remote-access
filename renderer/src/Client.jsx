import React, { useState, useRef, useEffect, useCallback } from 'react';

function Client({ onBack }) {
  const [sessionId, setSessionId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState('');
  const [config, setConfig] = useState(null);
  const [videoConnected, setVideoConnected] = useState(false);

  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const signalingWsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const mouseMoveRef = useRef(null);
  const inputCaptureRef = useRef(null);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await window.electronAPI.getConfig();
        setConfig(cfg);
        console.log('[Client] Config loaded:', cfg);
      } catch (err) {
        console.error('[Client] Failed to load config:', err);
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
    console.log('[Client] Cleaning up resources');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (mouseMoveRef.current) {
      cancelAnimationFrame(mouseMoveRef.current);
      mouseMoveRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (signalingWsRef.current) {
      signalingWsRef.current.close();
      signalingWsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleConnect = async () => {
    if (!sessionId.trim()) {
      setError('Please enter a session ID');
      return;
    }

    if (!config) {
      setError('Configuration not loaded');
      return;
    }

    try {
      setError('');
      setConnectionStatus('connecting');
      console.log('[Client] Connecting to session:', sessionId);

      // Initialize WebRTC
      await setupPeerConnection();

      // Connect to signaling server
      connectToSignaling(sessionId);

      // Wait a bit for signaling to connect, then create offer
      setTimeout(async () => {
        try {
          await createAndSendOffer();
        } catch (err) {
          console.error('[Client] Failed to create offer:', err);
          setError('Failed to create connection offer');
          setConnectionStatus('disconnected');
        }
      }, 500);
    } catch (err) {
      console.error('[Client] Failed to connect:', err);
      setError('Failed to connect: ' + err.message);
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

    // Handle incoming video stream
    pc.ontrack = (event) => {
      console.log('[Client] Remote stream received');
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        setVideoConnected(true);
        // Auto-play the video
        videoRef.current.play().catch(err => {
          console.error('[Client] Failed to play video:', err);
        });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[Client] ICE candidate generated');
        sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[Client] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
        setIsConnected(true);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Connection lost');
        setConnectionStatus('disconnected');
        setIsConnected(false);
      }
    };

    // Create data channel for input
    const channel = pc.createDataChannel('input', {
      ordered: false,
      maxRetransmits: 0,
    });

    setupDataChannel(channel);

    console.log('[Client] Peer connection created');
  };

  const setupDataChannel = (channel) => {
    dataChannelRef.current = channel;

    channel.onopen = () => {
      console.log('[Client] Data channel opened');
      setIsConnected(true);
    };

    channel.onclose = () => {
      console.log('[Client] Data channel closed');
      dataChannelRef.current = null;
      setIsConnected(false);
    };

    channel.onerror = (error) => {
      console.error('[Client] Data channel error:', error);
    };
  };

  const connectToSignaling = (sessionId) => {
    if (!config) return;

    const wsUrl = config.signalingUrl;
    console.log('[Client] Connecting to signaling server:', wsUrl);

    const ws = new WebSocket(wsUrl);
    signalingWsRef.current = ws;

    ws.onopen = () => {
      console.log('[Client] Connected to signaling server');
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
        console.log('[Client] Signaling message received:', message.type);

        switch (message.type) {
          case 'joined':
            console.log('[Client] Joined session:', message.sessionId);
            break;

          case 'offer':
            // Handle renegotiation offers from host
            await handleOffer(message);
            break;

          case 'answer':
            await handleAnswer(message);
            break;

          case 'ice-candidate':
            if (peerConnectionRef.current && message.candidate) {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(message.candidate)
              );
              console.log('[Client] ICE candidate added');
            }
            break;

          case 'error':
            console.error('[Client] Signaling error:', message.message);
            setError(message.message);
            break;

          default:
            console.log('[Client] Unknown signaling message:', message.type);
        }
      } catch (err) {
        console.error('[Client] Error processing signaling message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[Client] Signaling connection closed');
      signalingWsRef.current = null;

      // Auto-reconnect with exponential backoff
      if (sessionId && isConnected) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        console.log(`[Client] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connectToSignaling(sessionId);
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[Client] Signaling error:', error);
    };
  };

  const createAndSendOffer = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      throw new Error('Peer connection not initialized');
    }

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer via signaling
    sendSignalingMessage({
      type: 'offer',
      offer: pc.localDescription,
    });

    console.log('[Client] Offer created and sent');
  };

  const handleOffer = async (message) => {
    try {
      console.log('[Client] Handling renegotiation offer');
      const pc = peerConnectionRef.current;

      if (!pc) {
        console.error('[Client] No peer connection');
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

      console.log('[Client] Renegotiation answer sent');
    } catch (err) {
      console.error('[Client] Error handling offer:', err);
      setError('Failed to handle renegotiation offer: ' + err.message);
    }
  };

  const handleAnswer = async (message) => {
    try {
      console.log('[Client] Handling answer');
      const pc = peerConnectionRef.current;

      if (!pc) {
        console.error('[Client] No peer connection');
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
      console.log('[Client] Answer set successfully');
    } catch (err) {
      console.error('[Client] Error handling answer:', err);
      setError('Failed to handle connection answer: ' + err.message);
    }
  };

  const sendSignalingMessage = (message) => {
    if (signalingWsRef.current && signalingWsRef.current.readyState === WebSocket.OPEN) {
      signalingWsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[Client] Signaling not connected');
    }
  };

  const sendInput = (data) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(data));
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (mouseMoveRef.current) {
      cancelAnimationFrame(mouseMoveRef.current);
    }

    mouseMoveRef.current = requestAnimationFrame(() => {
      const rect = inputCaptureRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      sendInput({
        type: 'mousemove',
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      });
    });
  }, []);

  const handleMouseDown = (e) => {
    const button = e.button === 2 ? 'right' : 'left';
    sendInput({ type: 'mousedown', button });
  };

  const handleMouseUp = (e) => {
    const button = e.button === 2 ? 'right' : 'left';
    sendInput({ type: 'mouseup', button });
  };

  const handleDoubleClick = (e) => {
    const button = e.button === 2 ? 'right' : 'left';
    sendInput({ type: 'double-click', button });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    sendInput({
      type: 'scroll',
      deltaY: e.deltaY,
    });
  };

  const handleKeyDown = (e) => {
    // Prevent default for special keys to avoid local actions
    if (
      e.key === 'Tab' ||
      e.key === 'F5' ||
      (e.ctrlKey && e.key === 'r') ||
      (e.metaKey && e.key === 'r')
    ) {
      e.preventDefault();
    }

    const modifiers = [];
    if (e.ctrlKey) modifiers.push('control');
    if (e.altKey) modifiers.push('alt');
    if (e.metaKey) modifiers.push('command');
    if (e.shiftKey) modifiers.push('shift');

    sendInput({
      type: 'keydown',
      key: e.key,
      code: e.code,
      modifiers,
    });
  };

  const handleKeyUp = (e) => {
    sendInput({
      type: 'keyup',
      key: e.key,
      code: e.code,
    });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  const handleDisconnect = () => {
    cleanup();
    setSessionId('');
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setError('');
  };

  return (
    <div className="client-screen">
      <div className="header">
        <h1>Client Mode</h1>
        <div className="header-controls">
          <div className={`connection-status ${connectionStatus}`}>
            <span className="status-dot"></span>
            <span>{connectionStatus.toUpperCase()}</span>
          </div>
          <button className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>

      {!isConnected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="connect-form">
            <input
              type="text"
              className="session-input"
              placeholder="Enter Session ID"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              disabled={connectionStatus === 'connecting'}
            />
            <button
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={connectionStatus === 'connecting' || !sessionId.trim()}
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          </div>

          {error && (
            <div style={{ padding: '0 24px' }}>
              <div className="error-message">{error}</div>
            </div>
          )}

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {connectionStatus === 'connecting' ? (
              <>
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-secondary)' }}>Connecting to host...</p>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '24px', fontWeight: '600' }}>Enter Session ID</h3>
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '400px' }}>
                  Get the session ID from the host and enter it above to connect
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="video-container">
          {!videoConnected && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              zIndex: 10
            }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
              <p>Waiting for video stream...</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                Make sure host has granted screen recording permission
              </p>
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted style={{ opacity: videoConnected ? 1 : 0 }} />

          <div
            ref={inputCaptureRef}
            className="input-capture"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onContextMenu={handleContextMenu}
            tabIndex={0}
          />

          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              gap: '8px',
            }}
          >
            <button className="btn btn-danger" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Client;
