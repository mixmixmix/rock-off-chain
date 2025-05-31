import { useState, useEffect } from 'react';
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';

export function useAudioAnalysis(monoData, canvasRef) {
  const [freq, setFreq] = useState(null);

  useEffect(() => {
    if (!monoData) return;

    console.log('📊 Analyzing audio with Essentia.js...');
    const essentia = new Essentia(EssentiaWASM);
    const vfFrame = essentia.arrayToVector(monoData);
    const { pitch } = essentia.PitchYinFFT(vfFrame);
    setFreq(Math.round(pitch));
    console.log(`🎼 Detected pitch: ${pitch} Hz`);
    vfFrame.delete();
  }, [monoData]);

  useEffect(() => {
    if (!monoData || !canvasRef?.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const step = Math.ceil(monoData.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.beginPath();
    for (let i = 0; i < canvas.width; i++) {
      const segment = monoData.slice(i * step, (i + 1) * step);
      const min = Math.min(...segment);
      const max = Math.max(...segment);
      ctx.moveTo(i, (1 - min) * amp);
      ctx.lineTo(i, (1 - max) * amp);
    }

    ctx.strokeStyle = '#007aff';
    ctx.stroke();
  }, [monoData, canvasRef]);

  return { freq };
}
