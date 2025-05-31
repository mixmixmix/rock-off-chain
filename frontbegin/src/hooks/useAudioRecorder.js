import { useRef, useState } from 'react';
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';

export function useAudioRecorder() {
  const mediaRec = useRef(null);
  const chunks = useRef([]);
  const [freq, setFreq] = useState(null);
  const [recording, setRecording] = useState(false);
  const [monoData, setMonoData] = useState(null);

  const audioToggle = async () => {
    if (!recording) {
      try {
        console.log('🎙️ Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRec.current = new MediaRecorder(stream);

        mediaRec.current.ondataavailable = (e) => {
          console.log('📥 Captured audio chunk');
          chunks.current.push(e.data);
        };

        mediaRec.current.onstop = async () => {
          console.log('🛑 Recording stopped');

          const blob = new Blob(chunks.current, { type: 'audio/webm' });
          chunks.current = [];

          console.log('🔄 Decoding audio blob...');
          const arrayBuf = await blob.arrayBuffer();
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          const mono = audioBuf.getChannelData(0);

          setMonoData(mono.slice(0)); // copy for visualisation

          console.log('📊 Running analysis with Essentia.js...');
          const essentia = new Essentia(EssentiaWASM);
          const vfFrame = essentia.arrayToVector(mono);

          const { pitch } = essentia.PitchYinFFT(vfFrame);
          setFreq(Math.round(pitch));
          console.log(`🎼 Detected pitch: ${pitch} Hz`);

          vfFrame.delete(); // free WASM memory
        };

        console.log('▶️ Starting recording...');
        mediaRec.current.start();
        setRecording(true);

      } catch (err) {
        console.error('❌ Could not start audio capture:', err);
      }
    } else {
      console.log('⏹️ Stopping recording...');
      if (mediaRec.current) {
        mediaRec.current.stop();
        mediaRec.current.stream.getTracks().forEach((t) => t.stop());
      }
      setRecording(false);
    }
  };

  return {
    freq,
    recording,
    audioToggle,
    monoData,
  };
}
