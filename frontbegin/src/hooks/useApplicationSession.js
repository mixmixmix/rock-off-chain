// src/hooks/useApplicationSession.js
import { useCallback } from 'react';
import { createAppSessionMessage } from '@erc7824/nitrolite';

export function useApplicationSession(ws, signer, senderAddress) {
  const createApplicationSession = useCallback(
    async (participantB, amount) => {
      try {
        const participantA = senderAddress;

        const appDefinition = {
          protocol: 'nitroliterpc',
          participants: [participantA, participantB],
          weights: [100, 0],
          quorum: 100,
          challenge: 0,
          nonce: Date.now(),
        };

        const allocations = [
          { participant: participantA, asset: 'usdc', amount },
          { participant: participantB, asset: 'usdc', amount: '0' },
        ];

        const signedMessage = await createAppSessionMessage(
          signer,
          [{ definition: appDefinition, allocations }]
        );

        const sendRequest = async (payload) => {
          return new Promise((resolve, reject) => {
            const handleMessage = (event) => {
              try {
                const message = JSON.parse(event.data);
                if (message.res?.[1] === 'create_app_session') {
                  ws.removeEventListener('message', handleMessage);
                  resolve(message.res[2]);
                }
              } catch (err) {
                console.error('Message parsing failed:', err);
              }
            };

            ws.addEventListener('message', handleMessage);
            ws.send(payload);

            setTimeout(() => {
              ws.removeEventListener('message', handleMessage);
              reject(new Error('App session creation timeout'));
            }, 10000);
          });
        };

        const response = await sendRequest(signedMessage);

        if (response?.[0]?.app_session_id) {
          return { success: true, app_session_id: response[0].app_session_id };
        } else {
          return { success: true, response };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
    [ws, signer, senderAddress]
  );

  return { createApplicationSession };
}
