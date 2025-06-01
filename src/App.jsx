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
  const { recording, audioToggle, monoData, freq } = useAudioRecorder(canvasRef);
  const { freqSeries, silentFrames, analyzeAudio } = useAudioAnalysis();
  const [recordingCountdown, setRecordingCountdown] = useState(0);
  const [chartDataState, setChartDataState] = useState(null);
  const [lastPayout, setLastPayout] = useState(undefined);

  // Only generate chart data when we have frequency data
  useEffect(() => {
    if (freqSeries && freqSeries.length > 0) {
      const data = chartData(freqSeries);
      setChartDataState(data);
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

  const handleRecordFlow = async () => {
    if (!participantB) {
      alert('Please connect MetaMask first');
      return;
    }

    try {
      console.log('🎬 Starting recording flow...');

      // Create session
      console.log('📝 Creating session...');
      const result = await createApplicationSession(participantB, total_amount);
      if (!result.success || !result.app_session_id) {
        console.error('❌ Failed to create session:', result.error);
        alert('Failed to create session');
        return;
      }
      console.log('✅ Session created:', result.app_session_id);
      localStorage.setItem('app_session_id', result.app_session_id);

      // Start recording and wait for the audio data
      console.log('🎙️ Starting recording...');
      const audioData = await audioToggle();
      console.log('✅ Recording completed');

      // Run analysis on the audio data
      console.log('🔍 Running audio analysis...');
      if (audioData && audioData.length > 0) {
        analyzeAudio(audioData);
        console.log('✅ Analysis completed');
      } else {
        console.error('❌ No audio data available for analysis');
        throw new Error('No audio data available for analysis');
      }

      // Close session with frequency-based payout
      const appSessionId = localStorage.getItem('app_session_id');
      if (appSessionId) {
        // Get the chart data to check for minor chord and perfect fifth
        const { isMinorChord, hasPerfectFifth } = chartDataState || { isMinorChord: false, hasPerfectFifth: false };

        console.log('💰 Starting Payout Analysis:', {
          totalAmount: total_amount,
          isMinorChord,
          hasPerfectFifth,
          sessionId: appSessionId
        });

        // Calculate payout based on chord detection
        let payout = '0';
        if (isMinorChord) {
          payout = total_amount;
          console.log('💵 Full Payout Awarded:', {
            amount: payout,
            reason: 'Minor chord detected',
            calculation: `${total_amount} (full amount)`,
            type: 'MINOR_CHORD_PAYOUT'
          });
        } else if (hasPerfectFifth) {
          const halfAmount = Number(total_amount) / 2;
          payout = halfAmount.toString();
          console.log('💵 Half Payout Awarded:', {
            amount: payout,
            reason: 'Perfect fifth detected',
            calculation: `${total_amount} / 2 = ${halfAmount}`,
            type: 'PERFECT_FIFTH_PAYOUT'
          });
        } else {
          console.log('💵 No Payout Awarded:', {
            amount: payout,
            reason: 'No chord or fifth detected',
            calculation: '0 (no detection)',
            type: 'NO_PAYOUT'
          });
        }

        setLastPayout(payout);

        const remainingAmount = total_amount - payout;
        console.log('📊 Payout Summary:', {
          totalAmount: total_amount,
          payoutAmount: payout,
          remainingAmount: remainingAmount,
          payoutType: isMinorChord ? 'MINOR_CHORD' : (hasPerfectFifth ? 'PERFECT_FIFTH' : 'NONE'),
          sessionId: appSessionId
        });

        console.log('📦 Closing session with payout details:', {
          sessionId: appSessionId,
          payout,
          remaining: remainingAmount,
          participantA,
          participantB
        });

        await closeApplicationSession(appSessionId, participantA, participantB, remainingAmount, payout);
        localStorage.removeItem('app_session_id');
        console.log('✅ Session closed successfully:', {
          finalPayout: payout,
          sessionId: appSessionId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('❌ Error in recording flow:', err);
      alert('Error in recording flow: ' + err.message);

      // Clean up session ID if it exists
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
          <canvas
            ref={canvasRef}
            width={500}
            height={100}
          />
          <div style={{ width: '100%', marginTop: '2rem' }}>
            <Line data={{ labels, datasets }} options={options} />
          </div>
        </div>
        <div className="text-section">

          <h2>IMAGE </h2>
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
