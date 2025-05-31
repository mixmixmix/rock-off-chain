// src/hooks/useClearNodeConnection.js
import { useState, useCallback } from 'react';
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createGetChannelsMessage,
  createGetLedgerBalancesMessage
} from '@erc7824/nitrolite';

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

  const myExpire = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const eip712MessageSigner = useCallback(async (rawData) => {
    const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    const challenge = parsed?.[2]?.[0]?.challenge;
    if (!challenge) throw new Error('Missing challenge in ClearNode message');

    const message = {
      challenge,
      scope: 'console',
      wallet: walletAddress,
      application: walletAddress,
      participant: walletAddress,
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
  }, [walletClient, walletAddress, getAuthDomain, AUTH_TYPES]);

  const messageSigner = useCallback(async (payload) => {
    const msg = JSON.stringify(payload);
    return await walletClient.signMessage({
      account: walletClient.account,
      message: msg
    });
  }, [walletClient]);

  const requestLedgerBalances = useCallback(async (participant) => {
    const message = await createGetLedgerBalancesMessage(messageSigner, participant);
    ws.send(message);
  }, [messageSigner, ws]);

  const connect = useCallback(() => {
    const socket = new WebSocket('wss://clearnet.yellow.com/ws');
    let clearNodeJwt = '';

    socket.onopen = async () => {
      setStatus('connected');
      const authRequest = await createAuthRequestMessage({
        wallet: wallet.address,
        participant: wallet.address,
        app_name: getAuthDomain().name,
        expire: String(myExpire),
        scope: 'console',
        application: wallet.address,
        allowances: [],
      });
      socket.send(authRequest);
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        const topic = message.res?.[1];

        if (topic === 'auth_challenge') {
          const authVerifyMsg = await createAuthVerifyMessage(eip712MessageSigner, event.data);
          socket.send(authVerifyMsg);
        } else if (topic === 'auth_verify') {
          clearNodeJwt = message.res?.[2]?.[0]?.jwt_token || '';
          setIsAuthenticated(true);
          const getChannelsMsg = await createGetChannelsMessage(messageSigner, wallet.address);
          socket.send(getChannelsMsg);
        } else if (topic === 'auth_failure') {
          setError('Authentication failed: ' + message.res[2]);
        } else if (topic === 'get_channels') {
          const channelsList = message.res?.[2]?.[0] || [];
          setChannels(channelsList);
          channelsList.forEach(channel => requestLedgerBalances(channel.participant));
        } else if (topic === 'get_ledger_balances') {
          const participant = message.res?.[2]?.[0]?.participant;
          const result = message.res?.[2] || [];
          setBalances(prev => ({ ...prev, [participant]: result }));
        }
      } catch (err) {
        setError('Message handling error: ' + err.message);
      }
    };

    socket.onerror = (err) => setError('WebSocket error: ' + err.message);
    socket.onclose = () => setStatus('disconnected');

    setWs(socket);
  }, [wallet, walletAddress, eip712MessageSigner, messageSigner, getAuthDomain]);

  return {
    ws,
    status,
    isAuthenticated,
    error,
    channels,
    balances,
    connect,
    walletAddress,
    signer: messageSigner
  };
}
