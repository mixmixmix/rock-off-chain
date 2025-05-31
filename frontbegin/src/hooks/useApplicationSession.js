// src/hooks/useApplicationSession.js
import { useCallback } from 'react';
import { createAppSessionMessage } from '@erc7824/nitrolite';

const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

export function useApplicationSession(ws, sessionSignerFn, sessionAddr) {
  const createApplicationSession = useCallback(
    async (participantB, amount) => {
      log('🔧 Starting application session creation');

      try {
        const participantA = sessionAddr;
        log('📍 Session key (participant A):', participantA);
        log('📍 Participant B:', participantB);
        log('📍 Amount:', amount);

        const appDefinition = {
          protocol: 'nitroliterpc',
          participants: [participantA, participantB],
          weights: [100, 0],
          quorum: 100,
          challenge: 0,
          nonce: Date.now(),
        };

        log('📄 App definition:', appDefinition);

        const allocations = [
          { participant: participantA, asset: 'usdc', amount },
          { participant: participantB, asset: 'usdc', amount: '0' },
        ];

        log('📦 Allocations:', allocations);

        const signedMessage = await createAppSessionMessage(
          sessionSignerFn,
          [{ definition: appDefinition, allocations }]
        );

        log('✅ Signed message prepared');

        const sendRequest = async (payload) => {
          return new Promise((resolve, reject) => {
            const handleMessage = (event) => {
              try {
                const message = JSON.parse(event.data);
                log('📨 Received message from WS:', message);

                if (message.res?.[1] === 'create_app_session') {
                  ws.removeEventListener('message', handleMessage);
                  log('✅ App session response received');
                  resolve(message.res[2]);
                }
              } catch (err) {
                log('❌ Message parsing failed:', err);
              }
            };

            log('🚀 Sending message over WS');
            ws.addEventListener('message', handleMessage);
            ws.send(payload);

            setTimeout(() => {
              ws.removeEventListener('message', handleMessage);
              log('⏰ App session creation timeout');
              reject(new Error('App session creation timeout'));
            }, 10000);
          });
        };

        const response = await sendRequest(signedMessage);
        log('📬 Final response:', response);

        if (response?.[0]?.app_session_id) {
          log('✅ App session created with ID:', response[0].app_session_id);
          return { success: true, app_session_id: response[0].app_session_id };
        } else {
          log('⚠️ No session ID in response');
          return { success: true, response };
        }
      } catch (error) {
        log('❌ Error creating app session:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
    [ws, sessionSignerFn, sessionAddr]
  );

  return { createApplicationSession };
}
