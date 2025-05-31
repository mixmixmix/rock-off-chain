// src/hooks/useClearNodeConnection.js
import { useState, useCallback } from 'react';
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createGetChannelsMessage,
  createGetLedgerBalancesMessage
} from '@erc7824/nitrolite';
import { Wallet } from 'ethers';
import { getAddress, keccak256, id, getBytes } from 'ethers';

const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

export function useClearNodeConnection({
  wallet,
  walletClient,
  walletAddress,
  getAuthDomain,
  AUTH_TYPES
}) {
  const [ws, setWs] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [channels, setChannels] = useState([]);
  const [balances, setBalances] = useState({});
  const [error, setError] = useState(null);
  const [sessionSigner, setSessionSigner] = useState(null);
  const [sessionAddress, setSessionAddress] = useState(null);
  const [_, forceRender] = useState(0);

  const myExpire = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const channelMessageSigner = useCallback(async (payload) => {
    const msg = JSON.stringify(payload);
    return await walletClient.signMessage({
      account: walletClient.account,
      message: msg
    });
  }, [walletClient]);

  const connect = useCallback(() => {
    const socket = new WebSocket('wss://clearnet.yellow.com/ws');
    setWs(socket);
    let clearNodeJwt = '';

    log('🔑 Initializing session key');
    let sessionPrivateKey = localStorage.getItem('clearnode_session_privkey');
    if (!sessionPrivateKey) {
      const generated = Wallet.createRandom();
      sessionPrivateKey = keccak256(generated.privateKey);
      localStorage.setItem('clearnode_session_privkey', sessionPrivateKey);
      log('🆕 Generated new session key');
    } else {
      log('♻️ Loaded existing session key from localStorage');
    }

    const sessionWallet = new Wallet(sessionPrivateKey);
    const sessionAddr = getAddress(sessionWallet.address);
    setSessionAddress(sessionAddr);
    log('👤 Session address:', sessionAddr);

    const sessionSignerFn = async (payload) => {
      const message = JSON.stringify(payload);
      const digestHex = id(message);
      const messageBytes = getBytes(digestHex);
      const { serialized: signature } = sessionWallet.signingKey.sign(messageBytes);
      return signature;
    };

    setSessionSigner({
      sign: sessionSignerFn,
      address: sessionAddr
    });
    forceRender(x => x + 1);

    const eip712MessageSigner = async (rawData) => {
      const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const challenge = parsed?.[2]?.[0]?.challenge;
      if (!challenge) throw new Error('Missing challenge in ClearNode message');

      log('🔑 Signing EIP-712 message with challenge:', challenge);

      const message = {
        challenge,
        scope: 'console',
        wallet: walletAddress,
        application: walletAddress,
        participant: sessionAddr,
        expire: String(myExpire),
        allowances: [],
      };

      return await walletClient.signTypedData({
        account: walletClient.account,
        domain: getAuthDomain(),
        types: AUTH_TYPES,
        primaryType: 'Policy',
        message,
      });
    };

    const requestLedgerBalances = async (participant) => {
      const message = await createGetLedgerBalancesMessage(channelMessageSigner, '0x9d50c60853822e27Ac1a5E35B2903b055d7953C9');
      socket.send(message);
      log('📤 Sent get_ledger_balances for:', '0x9d50c60853822e27Ac1a5E35B2903b055d7953C9');
    };

    socket.onopen = async () => {
      setStatus('connected');
      log('🔌 WebSocket connected');
      const authRequest = await createAuthRequestMessage({
        wallet: wallet.address,
        participant: sessionAddr,
        app_name: getAuthDomain().name,
        expire: String(myExpire),
        scope: 'console',
        application: wallet.address,
        allowances: [],
      });
      socket.send(authRequest);
      log('📤 Sent auth_request');
    };

    socket.onmessage = async (event) => {
      log('📥 Message received:', event.data);
      try {
        const message = JSON.parse(event.data);
        const topic = message.res?.[1];
        log('📨 Message topic:', topic);

        if (topic === 'auth_challenge') {
          const authVerifyMsg = await createAuthVerifyMessage(eip712MessageSigner, event.data);
          socket.send(authVerifyMsg);
          log('📤 Sent auth_verify');
        } else if (topic === 'auth_verify') {
          clearNodeJwt = message.res?.[2]?.[0]?.jwt_token || '';
          setIsAuthenticated(true);
          const getChannelsMsg = await createGetChannelsMessage(channelMessageSigner, wallet.address);
          socket.send(getChannelsMsg);
          log('📤 Sent get_channels');
        } else if (topic === 'auth_failure') {
          setError('Authentication failed: ' + message.res[2]);
          log('❌ Auth failed:', message.res[2]);
        } else if (topic === 'get_channels') {
          const channelsList = message.res?.[2]?.[0] || [];
          setChannels(channelsList);
          log('📡 Received channels:', channelsList);
          for (const channel of channelsList) {
            await requestLedgerBalances(channel.participant);
          }
        } else if (topic === 'get_ledger_balances') {
          const participant = message.res?.[2]?.[0]?.participant;
          const result = message.res?.[2] || [];
          setBalances(prev => ({ ...prev, [participant]: result }));
          log('💰 Ledger balances for', participant, ':', result);
        }
      } catch (err) {
        setError('Message handling error: ' + err.message);
        log('❌ Message handling error:', err);
      }
    };

    socket.onerror = (err) => {
      setError('WebSocket error: ' + err.message);
      log('🔥 WebSocket error:', err);
    };

    socket.onclose = () => {
      setStatus('disconnected');
      log('🔌 WebSocket closed');
    };

  }, [wallet, walletAddress, walletClient, getAuthDomain, AUTH_TYPES]);

  return {
    ws,
    status,
    isAuthenticated,
    error,
    channels,
    balances,
    connect,
    walletAddress,
    signer: sessionSigner,
    sessionSigner,
    sessionAddress
  };
}
