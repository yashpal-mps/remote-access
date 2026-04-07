import React, { useState } from 'react';
import Host from './Host';
import Client from './Client';

function App() {
  const [mode, setMode] = useState('home'); // 'home' | 'host' | 'client'

  const handleBackToHome = () => {
    setMode('home');
  };

  return (
    <div className="app-container">
      {mode === 'home' && (
        <div className="home-screen">
          <h2>Capture It</h2>
          <p>
            Production-grade remote desktop application. Choose your role to get started.
          </p>
          <div className="mode-buttons">
            <button className="btn btn-primary" onClick={() => setMode('host')}>
              Start Hosting
            </button>
            <button className="btn btn-secondary" onClick={() => setMode('client')}>
              Connect to Host
            </button>
          </div>
        </div>
      )}

      {mode === 'host' && <Host onBack={handleBackToHome} />}

      {mode === 'client' && <Client onBack={handleBackToHome} />}
    </div>
  );
}

export default App;
