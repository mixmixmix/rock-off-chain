// src/hooks/useApplicationSession.js
import { useCallback } from 'react';
import { createAppSessionMessage, createCloseAppSessionMessage } from '@erc7824/nitrolite';

const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

export function useApplicationSession(ws, sessionSignerFn, sessionAddr) {
  const createApplicationSession = useCallback(
    async (participantB, amount) => {
      log('🔧 Starting application session creation');

      try {
        const participantA = '0x9d50c60853822e27Ac1a5E35B2903b055d7953C9';
        log('📍 participant A:', participantA);
        log('📍 Participant B:', participantB);
        log('📍 Amount:', amount);

        const appDefinition = {
          protocol: 'rock0ffChain', // use my app name
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
                  clearTimeout(timeout);
                  log('✅ App session response received');
                  localStorage.setItem('app_session_response', JSON.stringify(message.res[2]));
                  const sessionId = message.res?.[2]?.[0]?.app_session_id;
                  if (sessionId) {
                    localStorage.setItem('app_session_id', sessionId);
                    log('💾 Stored app_session_id in localStorage:', sessionId);
}

                  resolve(message.res[2]);
                }
              } catch (err) {
                log('❌ Message parsing failed:', err);
              }
            };

            log('🚀 Sending message over WS');
            ws.addEventListener('message', handleMessage);
            ws.send(payload);

            const timeout = setTimeout(() => {
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

  const closeApplicationSession = useCallback(
    async (appSessionId, participantA, participantB, amountA, amountB) => {
      log('📦 Closing app session:', appSessionId);

      log('We are giving to patricipant b:', amountB);
      const allocations = [
        { participant: participantA, asset: 'usdc', amount: amountA },
        { participant: participantB, asset: 'usdc', amount: amountB },
      ];

      try {
        const signedMessage = await createCloseAppSessionMessage(sessionSignerFn, [
          { app_session_id: appSessionId, allocations }
        ]);

        log('🚀 Sending close_app_session message:', signedMessage);

        return new Promise((resolve, reject) => {
          const handleMessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              log('📨 Received message from WS:', message);

              if (message.res?.[1] === 'close_app_session') {
                ws.removeEventListener('message', handleMessage);
                clearTimeout(timeout);
                localStorage.removeItem('app_session_id');
                log('✅ App session closed successfully:', message.res[2]);
                resolve(message.res[2]);
              }
            } catch (err) {
              log('❌ Error parsing close response:', err);
            }
          };

          ws.addEventListener('message', handleMessage);
          ws.send(signedMessage);

          const timeout = setTimeout(() => {
            ws.removeEventListener('message', handleMessage);
            log('⏰ Close session timeout');
            reject(new Error('Close session timeout'));
          }, 10000);
        });
      } catch (err) {
        log('❌ Failed to close app session:', err);
        return { success: false, error: err.message };
      }
    },
    [ws, sessionSignerFn]
  );

  return {
    createApplicationSession,
    closeApplicationSession,
  };
}
