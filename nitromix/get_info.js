import 'dotenv/config';
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createGetChannelsMessage,
  createGetLedgerBalancesMessage,
} from '@erc7824/nitrolite';
import { ethers, getAddress } from 'ethers';
import WebSocket from 'ws';
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

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) throw new Error('Missing PRIVATE_KEY in .env');

const wallet = privateKeyToAccount(privateKey);
const walletAddress = getAddress(wallet.address);
const myExpire = BigInt(Math.floor(Date.now() / 1000) + 3600);

const walletClient = createWalletClient({
  transport: http(process.env.POLYGON_RPC_URL),
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

ws.onopen = async () => {
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

const messageSigner = async (payload) => {
  const msg = JSON.stringify(payload);
  const digestHex = ethers.id(msg);
  const digestBytes = ethers.getBytes(digestHex);

  return await walletClient.signMessage({
    account: walletClient.account,
    message: msg
  });
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
      console.log('✅Authentication successful. JWT Token:', clearNodeJwt);
      console.log('Requesting channel information...');

      const getChannelsMsg = await createGetChannelsMessage(
        messageSigner,
        wallet.address
      );

      ws.send(getChannelsMsg);
    } else if (topic === 'auth_failure') {
      console.error('Authentication failed:', message.res[2]);
    } else if (topic === 'get_channels') {
      const channels = message.res?.[2]?.[0] || [];
      console.log('📡 Channels:', channels);
    }
    else {
      console.log('Other message:', topic);
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
};

ws.onerror = (err) => console.error('WebSocket error:', err);
ws.onclose = () => console.log('WebSocket closed');
