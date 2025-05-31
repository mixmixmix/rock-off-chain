// src/components/ChannelList.jsx
import React from 'react';

export default function ChannelList({ channels, balances }) {
  if (!channels.length) return <p>No channels found</p>;

  return (
    <div>
      <h3>Channels</h3>
      {channels.map((channel, index) => (
        <div key={index} style={{ borderBottom: '1px solid #ccc', marginBottom: '1rem' }}>
          <p><strong>ID:</strong> {channel.channel_id}</p>
          <p><strong>Status:</strong> {channel.status}</p>
          <p><strong>Participant:</strong> {channel.participant}</p>
          <p><strong>Token:</strong> {channel.token}</p>
          <p><strong>Amount:</strong> {channel.amount}</p>
          <p><strong>Chain ID:</strong> {channel.chain_id}</p>
          <p><strong>Adjudicator:</strong> {channel.adjudicator}</p>
          <p><strong>Challenge:</strong> {channel.challenge}</p>
          <p><strong>Nonce:</strong> {channel.nonce}</p>
          <p><strong>Version:</strong> {channel.version}</p>
          <p><strong>Created:</strong> {channel.created_at}</p>
          <p><strong>Updated:</strong> {channel.updated_at}</p>

          <div>
            <strong>Ledger Balances:</strong>
            {(balances[channel.participant] && balances[channel.participant].length > 0) ? (
              <ul>
                {balances[channel.participant].map((bal, i) => (
                  <li key={i}>{bal.asset}: {bal.amount}</li>
                ))}
              </ul>
            ) : (
              <p>No ledger balances available.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
