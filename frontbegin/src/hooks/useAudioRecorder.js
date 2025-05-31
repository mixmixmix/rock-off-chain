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

    for (let i = 0; i < width; i++) {
      const sample = data[i * step] || 0;
      const y = (1 - sample) * (height / 2);
      ctx.lineTo(i, y);
    }

    ctx.strokeStyle = '#007';
    ctx.lineWidth = 1;
    ctx.stroke();
    console.log('✅ Waveform drawn.');
  };

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
        };

        chunks.current = [];
        mediaRec.current.start();
        setRecording(true);
        console.log('▶️ Recording started...');
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
