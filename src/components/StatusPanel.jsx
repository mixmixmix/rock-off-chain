// src/components/StatusPanel.jsx
import React from 'react';

export default function StatusPanel({
  status,
  isAuthenticated,
  error,
  onConnect,
  canConnect
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p>Status: {status}</p>
      <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <button onClick={onConnect} disabled={!canConnect}>
        Connect to ClearNode
      </button>
    </div>
  );
}
