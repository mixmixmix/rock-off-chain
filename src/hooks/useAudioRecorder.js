import { useRef, useState } from 'react';
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';

export function useAudioRecorder(canvasRef) {
  const mediaRec = useRef(null);
  const chunks = useRef([]);
  const [freq, setFreq] = useState(null);
  const [recording, setRecording] = useState(false);
  const [monoData, setMonoData] = useState(null);

  const drawWaveform = (data) => {
    console.log('🖼 Drawing waveform...');
    if (!canvasRef?.current) {
      console.warn('⚠️ No canvasRef available.');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    if (!ctx) {
      console.warn('⚠️ Failed to get canvas context.');
      return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);

    const step = Math.ceil(data.length / width);
    console.log(`📏 Drawing with step: ${step}, data.length: ${data.length}, canvas.width: ${width}`);

    // Calculate amplitude distribution
    const amplitudes = [];
    for (let i = 0; i < data.length; i += step) {
      amplitudes.push(Math.abs(data[i] || 0));
    }
    amplitudes.sort((a, b) => a - b);
    
    // Use 95th percentile for scaling to allow some peaks to clip
    const percentile95 = amplitudes[Math.floor(amplitudes.length * 0.95)];
    const scaleFactor = (height/2) / percentile95;

    for (let i = 0; i < width; i++) {
      const sample = data[i * step] || 0;
      // Scale the sample and allow clipping
      const y = height/2 - sample * scaleFactor;
      ctx.lineTo(i, y);
    }

    ctx.strokeStyle = '#ffb547';
    ctx.lineWidth = 2;
    ctx.stroke();
    console.log('✅ Waveform drawn.');
  };

  const audioToggle = async () => {
    if (!recording) {
      try {
        console.log('🎙️ Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRec.current = new MediaRecorder(stream);

        // Create a promise that will resolve with the audio data
        const audioDataPromise = new Promise((resolve) => {
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

            console.log('🎚 Mono data length:', mono.length);
            setMonoData(mono.slice(0));

            drawWaveform(mono);

            console.log('🧪 Running pitch analysis...');
            const essentia = new Essentia(EssentiaWASM);
            const vf = essentia.arrayToVector(mono);
            const { pitch } = essentia.PitchYinFFT(vf);
            setFreq(Math.round(pitch));
            console.log(`🎼 Detected pitch: ${pitch.toFixed(2)} Hz`);
            vf.delete();

            // Resolve the promise with the mono data
            resolve(mono);
          };
        });

        chunks.current = [];
        mediaRec.current.start();
        setRecording(true);
        console.log('▶️ Recording started...');

        // Automatically stop after 3 seconds
        setTimeout(() => {
          if (mediaRec.current && mediaRec.current.state === 'recording') {
            mediaRec.current.stop();
            mediaRec.current.stream.getTracks().forEach((t) => t.stop());
            setRecording(false);
          }
        }, 3000);

        // Return the promise that will resolve with the audio data
        return audioDataPromise;
      } catch (err) {
        console.error('❌ Could not start audio capture:', err);
        throw err;
      }
    }
  };

  return {
    freq,
    recording,
    audioToggle,
    monoData,
  };
}
