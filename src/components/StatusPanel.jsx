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
      <p>Status: {status}</p>
      <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}
