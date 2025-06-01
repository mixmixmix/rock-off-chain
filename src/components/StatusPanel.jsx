// src/components/StatusPanel.jsx
import React from 'react';

export default function StatusPanel({
  status,
  isAuthenticated,
  error,
  canConnect,
  payout,
  isMinorChord,
  hasPerfectFifth,
  topNotes
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      {payout !== undefined && (
        <p>
          <span className="status-label">💰 Payout:</span>
          <span className={Number(payout) > 0 ? 'status-on' : 'status-off'}>
            {Number(payout) > 0 ? `🎉 ${payout} USDC` : `😢 ${payout} USDC`}
          </span>
        </p>
      )}
      {isMinorChord && (
        <p className="status-on">
          🎵 You managed a minor chord! 🎸 🎹 🎼
        </p>
      )}
      {hasPerfectFifth && !isMinorChord && (
        <p className="status-on">
          🎵 You managed a perfect fifth! 🎸 🎹
        </p>
      )}
      {topNotes && topNotes.length > 0 && (
        <p>
          <span className="status-label">🎹 Top Notes:</span>
          <span className="status-on">
            {topNotes.slice(0, 3).map(note => note.note).join(' - ')}
          </span>
        </p>
      )}
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
