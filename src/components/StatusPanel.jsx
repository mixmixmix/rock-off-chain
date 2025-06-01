// src/components/StatusPanel.jsx
import React from 'react';

export default function StatusPanel({
  status,
  isAuthenticated,
  error,
  canConnect
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p>
        <span className="status-label">🔌 Status:</span>
        <span className={status === 'connected' ? 'status-on' : 'status-off'}>
          {status === 'connected' ? 'ON' : 'OFF'}
        </span>
      </p>
      <p>
        <span className="status-label">🔐 Auth:</span>
        <span className={isAuthenticated ? 'status-on' : 'status-off'}>
          {isAuthenticated ? 'ON' : 'OFF'}
        </span>
      </p>
      {error && (
        <p className="status-off">
          ⚠️ Error: {error}
        </p>
      )}
    </div>
  );
}
