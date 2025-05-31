import React, { useRef, useState, useEffect } from 'react';
import { ethers, BrowserProvider, getAddress } from 'ethers';

import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';

import { getAuthDomain, AUTH_TYPES } from './utils/constants';
import { useClearNodeConnection } from './hooks/useClearNodeConnection';
import { useApplicationSession } from './hooks/useApplicationSession';
import StatusPanel from './components/StatusPanel';
import ChannelList from './components/ChannelList';

import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';


export default function App() {
  const privateKey = import.meta.env.VITE_PRIVATE_KEY;
  const rpcUrl = import.meta.env.VITE_POLYGON_RPC_URL;
  const [connected, setConnected] = useState(false);
  const [participantB, setParticipantB] = useState(null);

  //audio stuff
const mediaRec = useRef(null);
const chunks = useRef([]);
const [freq, setFreq] = useState(null);
const [recording, setRecording] = useState(false);


const audioToggle = async () => {
  if (!recording) {
    try {
      // ─── start recording ──────────────────────────────────────────────────────
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRec.current = new MediaRecorder(stream);
      mediaRec.current.ondataavailable = e => chunks.current.push(e.data);

      mediaRec.current.onstop = async () => {
        // turn the buffers we collected into a single WebM blob
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        chunks.current = [];

        // decode it so we can run analysis
        const arrayBuf = await blob.arrayBuffer();
        const ctx      = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        const mono     = audioBuf.getChannelData(0);        // Float32Array

        console.log("hello dolly");
        console.log(mono.constructor.name, mono.length);

        // ─── Essentia.js (WASM) analysis ───────────────────────────────────────
        const essentia = new Essentia(EssentiaWASM);
        const vfFrame  = essentia.arrayToVector(mono);

        console.log("hello dolly2");
        console.log(vfFrame.constructor.name, vfFrame.length);

        // quick smoke-test
        const e  = new Essentia(EssentiaWASM);
        const vf = e.arrayToVector(new Float32Array([1, 2, 3]));
        console.log(e.Mean(vf).mean); // => 2
        vf.delete();                  // free the memory Essentia allocated

        // actual pitch detection
        const { pitch } = essentia.PitchYinFFT(vfFrame);
        setFreq(Math.round(pitch));

        vfFrame.delete();             // tidy up
      };

      mediaRec.current.start();
      setRecording(true);
    } catch (err) {
      console.error("Could not start audio capture:", err);
    }
  } else {
    // ─── stop recording ────────────────────────────────────────────────────────
    if (mediaRec.current) {
      mediaRec.current.stop();
      mediaRec.current.stream.getTracks().forEach(t => t.stop());
    }
    setRecording(false);
  }
};


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

    // 💰 Request ledger balance every ping
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

  // Rule: payout if dice ≥ 4
  const payout = dice >= 4 ? '0.0001' : '0';
  console.log(`💰 Calculated payout to B: ${payout} USDC`);

  try {
    const result = await closeApplicationSession(appSessionId, participantA, participantB, total_amount-payout,  payout);
    console.log('✅ Session close result:', result);
    alert(`✅ Session closed. Payout: ${payout} USDC`);
  } catch (err) {
    console.error('❌ Failed to close session:', err);
    alert(`❌ Failed to close session:\n${err.message}`);
  }
};

  const connectMetamask = async () => {
    console.log('[MetaMask] Checking for Ethereum provider…');
    if (!window.ethereum) {
      console.error('[MetaMask] No window.ethereum found. Prompting install.');
      alert('Install MetaMask');
      return;
    }

    console.log('[MetaMask] Provider found. Creating BrowserProvider…');
    const provider = new BrowserProvider(window.ethereum);

    console.log('[MetaMask] Requesting accounts…');
    try {
      await provider.send('eth_requestAccounts', []);
    } catch (err) {
      console.error('[MetaMask] Account request rejected:', err);
      return;
    }
    console.log('[MetaMask] Accounts granted.');

    console.log('[MetaMask] Getting signer…');
    let signer;
    try {
      signer = await provider.getSigner();
    } catch (err) {
      console.error('[MetaMask] Failed to get signer:', err);
      return;
    }
    console.log('[MetaMask] Signer acquired.');

    console.log('[MetaMask] Retrieving address…');
    let addr;
    try {
      addr = await signer.getAddress();
      addr = getAddress(addr);
    } catch (err) {
      console.error('[MetaMask] Failed to fetch address:', err);
      return;
    }
    console.log('[MetaMask] Address retrieved:', addr);

    setParticipantB(addr);
    console.log('[MetaMask] participantB state set to:', addr);
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
      {freq && <p>Dominant frequency: {freq} Hz</p>}


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
