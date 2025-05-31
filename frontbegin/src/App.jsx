// File: src/App.jsx
import { useEffect, useState } from 'react';
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createGetChannelsMessage
} from '@erc7824/nitrolite';
import { ethers, getAddress } from 'ethers';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';

const getAuthDomain = () => ({
  name: 'Test App Mi',
});

const AUTH_TYPES = {
  Policy: [
    { name: 'challenge', type: 'string' },
    { name: 'scope', type: 'string' },
    { name: 'wallet', type: 'address' },
    { name: 'application', type: 'address' },
    { name: 'participant', type: 'address' },
    { name: 'expire', type: 'uint256' },
    { name: 'allowances', type: 'Allowance[]' },
  ],
  Allowance: [
    { name: 'asset', type: 'string' },
    { name: 'amount', type: 'uint256' },
  ],
};

function App() {
  const [status, setStatus] = useState('disconnected');
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const privateKey = import.meta.env.VITE_PRIVATE_KEY;
    const rpcUrl = import.meta.env.VITE_POLYGON_RPC_URL;
    if (!privateKey || !rpcUrl) {
      setError('Missing PRIVATE_KEY or RPC URL in .env');
      return;
    }

    const wallet = privateKeyToAccount(privateKey);
    const walletAddress = getAddress(wallet.address);
    const myExpire = BigInt(Math.floor(Date.now() / 1000) + 3600);

    const walletClient = createWalletClient({
      transport: http(rpcUrl),
      chain: polygon,
      account: wallet,
    });

    const ws = new WebSocket('wss://clearnet.yellow.com/ws');
    let clearNodeJwt = '';

    const eip712MessageSigner = async (rawData) => {
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
    };

    const messageSigner = async (payload) => {
      const msg = JSON.stringify(payload);
      return await walletClient.signMessage({
        account: walletClient.account,
        message: msg
      });
    };

    ws.onopen = async () => {
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
      ws.send(authRequest);
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        const topic = message.res?.[1];

        if (topic === 'auth_challenge') {
          const authVerifyMsg = await createAuthVerifyMessage(
            eip712MessageSigner,
            event.data
          );
          ws.send(authVerifyMsg);
        } else if (topic === 'auth_verify') {
          clearNodeJwt = message.res?.[2]?.[0]?.jwt_token || '';
          const getChannelsMsg = await createGetChannelsMessage(
            messageSigner,
            wallet.address
          );
          ws.send(getChannelsMsg);
        } else if (topic === 'auth_failure') {
          setError('Authentication failed: ' + message.res[2]);
        } else if (topic === 'get_channels') {
          setChannels(message.res?.[2]?.[0] || []);
        }
      } catch (err) {
        setError('Message handling error: ' + err.message);
      }
    };

    ws.onerror = (err) => setError('WebSocket error: ' + err.message);
    ws.onclose = () => setStatus('disconnected');

    return () => ws.close();
  }, []);

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>ClearNode Channels</h2>
      <p>Status: {status}</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <h3>Channels</h3>
      <ul>
        {channels.length === 0 && <li>No channels found</li>}
        {channels.map((channel, index) => (
          <li key={index}>
            <strong>ID:</strong> {channel.channel_id} — <strong>Status:</strong> {channel.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
