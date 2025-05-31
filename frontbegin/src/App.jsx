// File: src/App.jsx
import React from 'react';
import { useState } from 'react';
import { ethers, getAddress } from 'ethers';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';

import { getAuthDomain, AUTH_TYPES } from './utils/constants';
import { useClearNodeConnection } from './hooks/useClearNodeConnection';
import { useApplicationSession } from './hooks/useApplicationSession';
import StatusPanel from './components/StatusPanel';
import ChannelList from './components/ChannelList';

export default function App() {
  const privateKey = import.meta.env.VITE_PRIVATE_KEY;
  const rpcUrl = import.meta.env.VITE_POLYGON_RPC_URL;
  const [connected, setConnected] = useState(false);

  if (!privateKey || !rpcUrl) {
    return <p style={{ color: 'red' }}>Missing PRIVATE_KEY or RPC URL</p>;
  }

  const wallet = privateKeyToAccount(privateKey);
  const walletAddress = getAddress(wallet.address);

  const walletClient = createWalletClient({
    transport: http(rpcUrl),
    chain: polygon,
    account: wallet,
  });

  const {
    ws,
    status,
    isAuthenticated,
    error,
    channels,
    balances,
    connect,
    walletAddress: resolvedAddress,
    sessionSigner
  } = useClearNodeConnection({
    wallet,
    walletClient,
    walletAddress,
    getAuthDomain,
    AUTH_TYPES
  });

  const { createApplicationSession } = useApplicationSession(
    ws,
    sessionSigner?.sign,
    sessionSigner?.address
  );
  const handleSessionCreate = async () => {
    const participantB = '0x656347DCa3bF0c127C8E4A93625f27b2367705a0';
    const amount = '100';

    try {
      const result = await createApplicationSession(participantB, amount);
      if (result.success && result.app_session_id) {
        alert(`✅ Session created!\nSession ID: ${result.app_session_id}`);
      } else if (result.success) {
        alert('Session creation request sent, but no session ID returned.');
      } else {
        alert(`❌ Failed to create session:\n${result.error}`);
      }
    } catch (err) {
      alert(`❌ Unexpected error:\n${err.message}`);
    }
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>ClearNode Channels</h2>

      <StatusPanel
        status={status}
        isAuthenticated={isAuthenticated}
        error={error}
        onConnect={() => {
          connect();
          setConnected(true);
        }}
        canConnect={!connected}
      />

      {isAuthenticated && sessionSigner && (
        <>
          <button onClick={handleSessionCreate} style={{ marginBottom: '1rem' }}>
            Create Application Session
          </button>
          <button onClick={() => {
            localStorage.removeItem('clearnode_session_privkey');
            window.location.reload();
          }}>
            🔁 Reset Session Key
          </button>
        </>
      )}

      <ChannelList channels={channels} balances={balances} />
    </div>
  );
}
