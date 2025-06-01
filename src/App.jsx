import React, { useState, useEffect, useRef } from 'react';
import { ethers, BrowserProvider, getAddress } from 'ethers';
import { Line } from 'react-chartjs-2';
import bannerImage from './assets/banner.png';
import playImage from './assets/play.png';
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
  const total_amount = '0.0001';

  const [connected, setConnected] = useState(false);
  const [participantB, setParticipantB] = useState(null);
  const [lastPayout, setLastPayout] = useState(undefined);
  const canvasRef = useRef(null);

  const { recording, audioToggle, monoData, freq } = useAudioRecorder(canvasRef);
  const { freqSeries, silentFrames, analyzeAudio } = useAudioAnalysis();
  const [recordingCountdown, setRecordingCountdown] = useState(0);
  const [chartDataState, setChartDataState] = useState(null);

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

  useEffect(() => {
    if (freqSeries && freqSeries.length > 0) {
      const data = chartData(freqSeries);
      setChartDataState(data);

      const appSessionId = localStorage.getItem('app_session_id');
      if (!appSessionId) return;

      const { isMinorChord, hasPerfectFifth } = data || {};
      let payout = '0';

      if (isMinorChord) {
        payout = total_amount;
      } else if (hasPerfectFifth) {
        payout = (Number(total_amount) / 2).toString();
      }

      setLastPayout(payout);
      const remainingAmount = (Number(total_amount) - Number(payout)).toString();

      console.log('📊 Payout Summary:', {
        totalAmount: total_amount,
        payoutAmount: payout,
        remainingAmount: remainingAmount,
        payoutType: isMinorChord ? 'MINOR_CHORD' : (hasPerfectFifth ? 'PERFECT_FIFTH' : 'NONE'),
        sessionId: appSessionId
      });

      closeApplicationSession(appSessionId, participantA, participantB, remainingAmount, payout);
      localStorage.removeItem('app_session_id');
    }
  }, [freqSeries]);

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

  const handleRecordFlow = async () => {
    if (!participantB) {
      alert('Please connect MetaMask first');
      return;
    }

    try {
      console.log('🎬 Starting recording flow...');
      const result = await createApplicationSession(participantB, total_amount);
      if (!result.success || !result.app_session_id) {
        alert('Failed to create session');
        return;
      }

      console.log('✅ Session created:', result.app_session_id);
      localStorage.setItem('app_session_id', result.app_session_id);

      console.log('🎙️ Starting recording...');
      const audioData = await audioToggle();
      console.log('✅ Recording completed');

      if (audioData && audioData.length > 0) {
        console.log('🔍 Running audio analysis...');
        analyzeAudio(audioData);
      } else {
        throw new Error('No audio data available for analysis');
      }

    } catch (err) {
      console.error('❌ Error in recording flow:', err);
      alert('Error in recording flow: ' + err.message);
      const appSessionId = localStorage.getItem('app_session_id');
      if (appSessionId) {
        localStorage.removeItem('app_session_id');
      }
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

  if (!privateKey || !rpcUrl) {
    return <p style={{ color: 'red' }}>Missing PRIVATE_KEY or RPC URL</p>;
  }

  const { labels, datasets, commonFreqs, noteSeries, topNotes } = chartDataState || {
    labels: [],
    datasets: [],
    commonFreqs: [],
    noteSeries: [],
    topNotes: []
  };
  const options = generateChartOptions(commonFreqs || []);

  return (
    <div className="app-container">
      <div className="banner">
        <img src={bannerImage} alt="Banner" />
      </div>
      <div className="main-content">
        <div className="canvas-section">
          <canvas ref={canvasRef} width={500} height={100} />
          <div style={{ width: '100%', marginTop: '2rem' }}>
            <Line data={{ labels, datasets }} options={options} />
          </div>
        </div>
        <div className="text-section">
          <img src={playImage} alt="Play" style={{ width: '100%', maxWidth: '300px', marginBottom: '1rem' }} />
          <p className="wallet-status">
            <span className="status-label">🔗 Wallet:</span>
            {participantB ? (
              <span className="status-on">{participantB}</span>
            ) : (
              <span className="status-off">OFF</span>
            )}
          </p>
          <StatusPanel
            status={status}
            isAuthenticated={isAuthenticated}
            error={error}
            canConnect={!connected}
            payout={lastPayout}
            isMinorChord={chartDataState?.isMinorChord}
            hasPerfectFifth={chartDataState?.hasPerfectFifth}
            topNotes={chartDataState?.topNotes}
          />
          <ChannelList channels={channels} />
        </div>
      </div>
      <div className="button-row">
        <button
          onClick={() => {
            connect();
            setConnected(true);
          }}
          disabled={connected}
        >
          🔌 Connect to ClearNode
        </button>
        <button
          onClick={connectMetamask}
          disabled={!!participantB}
        >
          🦊 Connect MetaMask
        </button>
        <button
          onClick={handleRecordFlow}
          disabled={recording || !isAuthenticated || !sessionSigner || !participantB}
        >
          {recording ? `🎙️ Recording... ${recordingCountdown}s` : '🎙️ Record & Process'}
        </button>
      </div>
    </div>
  );
}
