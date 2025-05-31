import React, { useState, useEffect, useRef } from 'react';
import { ethers, BrowserProvider, getAddress } from 'ethers';
import { Line } from 'react-chartjs-2';

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';

import { getAuthDomain, AUTH_TYPES } from './utils/constants';
import { useClearNodeConnection } from './hooks/useClearNodeConnection';
import { useApplicationSession } from './hooks/useApplicationSession';
import StatusPanel from './components/StatusPanel';
import ChannelList from './components/ChannelList';

import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useAudioAnalysis } from './hooks/useAudioAnalysis';

import { freqToNote, chartData, chartOptions } from './utils/piano';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LogarithmicScale,
  PointElement,
  Title
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LogarithmicScale, PointElement, Title);

export default function App() {
  const privateKey = import.meta.env.VITE_PRIVATE_KEY;
  const rpcUrl = import.meta.env.VITE_POLYGON_RPC_URL;
  const [connected, setConnected] = useState(false);
  const [participantB, setParticipantB] = useState(null);

  const canvasRef = useRef(null);
  const { recording, audioToggle, monoData } = useAudioRecorder(canvasRef);
  const { freqSeries } = useAudioAnalysis(monoData);

  if (!privateKey || !rpcUrl) {
    return <p style={{ color: 'red' }}>Missing PRIVATE_KEY or RPC URL</p>;
  }

  const wallet = privateKeyToAccount(privateKey);
  const walletAddress = getAddress(wallet.address);
  const participantA = walletAddress;

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
    sessionSigner,
    requestLedgerBalances
  } = useClearNodeConnection({
    wallet,
    walletClient,
    walletAddress,
    getAuthDomain,
    AUTH_TYPES
  });

  const {
    createApplicationSession,
    closeApplicationSession
  } = useApplicationSession(ws, sessionSigner?.sign, sessionSigner?.address);

  const total_amount = '0.0001';

  const handleSessionCreate = async () => {
    try {
      const result = await createApplicationSession(participantB, total_amount);
      if (result.success && result.app_session_id) {
        alert(`✅ Session created!\nSession ID: ${result.app_session_id}`);
        localStorage.setItem('app_session_id', result.app_session_id);
      } else if (result.success) {
        alert('Session creation request sent, but no session ID returned.');
      } else {
        alert(`❌ Failed to create session:\n${result.error}`);
      }
    } catch (err) {
      alert(`❌ Unexpected error:\n${err.message}`);
    }
  };

  useEffect(() => {
    if (!ws || !sessionSigner || !requestLedgerBalances) return;

    const interval = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const ts1 = Date.now();
      const ts2 = Date.now();
      const payload = [ts1, "ping", [], ts2];
      const signature = await sessionSigner.sign(payload);

      ws.send(JSON.stringify({
        req: payload,
        sig: [signature]
      }));
      console.log('📡 Sent signed ping');

      const account = sessionSigner.address;
      await requestLedgerBalances(account);
      console.log(`[Ledger] Requested balances for ${account}`);
    }, 10000);

    return () => clearInterval(interval);
  }, [ws, sessionSigner, requestLedgerBalances]);

  const rollDice = () => {
    const result = Math.floor(Math.random() * 6) + 1;
    console.log(`🎲 Dice rolled: ${result}`);
    localStorage.setItem('last_dice_result', result.toString());

    const appSessionId = localStorage.getItem('app_session_id');
    if (!appSessionId) {
      console.warn('❌ No app session ID in localStorage');
      return;
    }
  };

  const handleCloseSession = async () => {
    console.log('📦 Closing session...');
    const appSessionId = localStorage.getItem('app_session_id');
    const dice = parseInt(localStorage.getItem('last_dice_result') || '0');
    console.log('🎲 Previous dice result:', dice);

    if (!appSessionId) {
      console.warn('❌ No app session ID in localStorage');
      return;
    }

    const payout = dice >= 4 ? '0.0001' : '0';
    console.log(`💰 Calculated payout to B: ${payout} USDC`);

    try {
      const result = await closeApplicationSession(appSessionId, participantA, participantB, total_amount - payout, payout);
      console.log('✅ Session close result:', result);
      alert(`✅ Session closed. Payout: ${payout} USDC`);
    } catch (err) {
      console.error('❌ Failed to close session:', err);
      alert(`❌ Failed to close session:\n${err.message}`);
    }
  };

  const connectMetamask = async () => {
    if (!window.ethereum) {
      alert('Install MetaMask');
      return;
    }

    const provider = new BrowserProvider(window.ethereum);
    try {
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const addr = getAddress(await signer.getAddress());
      setParticipantB(addr);
    } catch (err) {
      console.error('[MetaMask] Error:', err);
    }
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>ClearNode Channels</h2>

      {participantB && (
        <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
          🔗 Connected wallet: <code>{participantB}</code>
        </p>
      )}

      <button onClick={audioToggle}>{recording ? 'Stop' : 'Record'}</button>
      <canvas
        ref={canvasRef}
        width={500}
        height={100}
        style={{ border: '1px solid #ccc', margin: '1rem 0' }}
      />

      <div style={{ width: '90%', margin: '2rem auto' }}>
        <h2>Dominant Frequency Time Series</h2>
        <Line data={chartData(freqSeries)} options={chartOptions} />
      </div>

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
          <button onClick={rollDice}>🎲 Roll Dice</button>
          <button onClick={handleCloseSession}>❌ Close Session</button>
          {!participantB && (
            <button onClick={connectMetamask}>🔌 Connect MetaMask</button>
          )}
        </>
      )}

      <ChannelList channels={channels} balances={balances} />
    </div>
  );
}
