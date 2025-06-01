import React, { useState, useEffect, useRef } from 'react';
import { ethers, BrowserProvider, getAddress } from 'ethers';
import { Line } from 'react-chartjs-2';
import bannerImage from './assets/banner.png';
import './App.css';

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

import { chartData, generateChartOptions } from './utils/piano';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LogarithmicScale,
  PointElement,
  Title
} from 'chart.js';

import annotationPlugin from 'chartjs-plugin-annotation';
ChartJS.register(LineElement, CategoryScale, LogarithmicScale, PointElement, Title, annotationPlugin);

export default function App() {
  const privateKey = import.meta.env.VITE_PRIVATE_KEY;
  const rpcUrl = import.meta.env.VITE_POLYGON_RPC_URL;
  const [connected, setConnected] = useState(false);
  const [participantB, setParticipantB] = useState(null);

  const canvasRef = useRef(null);
  const { recording, audioToggle, monoData } = useAudioRecorder(canvasRef);
  const { freqSeries, silentFrames } = useAudioAnalysis(monoData);
  const [recordingCountdown, setRecordingCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (recording) {
      setRecordingCountdown(3);
      timer = setInterval(() => {
        setRecordingCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recording]);

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
    connect,
    walletAddress: resolvedAddress,
    sessionSigner,
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
    if (!ws || !sessionSigner) return;

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
    }, 10000);

    return () => clearInterval(interval);
  }, [ws, sessionSigner]);

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
      console.error('❌ [MetaMask] Error:', err);
    }
  };

  const { labels, datasets, commonFreqs, noteSeries, topNotes } = chartData(freqSeries);
  const options = generateChartOptions(commonFreqs);

  return (
    <div className="app-container">
      <div className="banner">
        <img src={bannerImage} alt="Banner" />
      </div>
      <div className="button-row">
        <button onClick={audioToggle} disabled={recording}>
          {recording ? `Recording... ${recordingCountdown}s` : 'Record'}
        </button>
        <button
          onClick={() => {
            connect();
            setConnected(true);
          }}
          disabled={connected}
        >
          Connect to ClearNode
        </button>
        <button
          onClick={handleSessionCreate}
          disabled={!isAuthenticated || !sessionSigner}
        >
          Create Application Session
        </button>
        <button
          onClick={handleCloseSession}
          disabled={!isAuthenticated || !sessionSigner}
        >
          ❌ Close Session
        </button>
        <button
          onClick={connectMetamask}
          disabled={!!participantB}
        >
          🔌 Connect MetaMask
        </button>
      </div>
      <div className="main-content">
        <div className="canvas-section">
          <canvas
            ref={canvasRef}
            width={500}
            height={100}
          />
          <div style={{ width: '100%', marginTop: '2rem' }}>
            <h2>Dominant Frequency Time Series</h2>
            <Line data={{ labels, datasets }} options={options} />
          </div>
        </div>
        <div className="text-section">
          <h2>ClearNode Channels</h2>
          {participantB && (
            <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
              🔗 Connected wallet: <code>{participantB}</code>
            </p>
          )}
          <StatusPanel
            status={status}
            isAuthenticated={isAuthenticated}
            error={error}
            canConnect={!connected}
          />
          <ChannelList channels={channels} />
        </div>
      </div>
    </div>
  );
}
