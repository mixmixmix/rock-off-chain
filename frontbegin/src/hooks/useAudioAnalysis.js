import { useState, useEffect } from 'react';
import { create, all } from 'mathjs';

const math = create(all);

export function useAudioAnalysis(monoData, sampleRate = 44100) {
  const [freqSeries, setFreqSeries] = useState([]);

  useEffect(() => {
    if (!monoData) return;

    const frameSize = 1024;
    const hopSize = 512;

    const freqs = [];

    for (let i = 0; i + frameSize <= monoData.length; i += hopSize) {
      const frame = monoData.slice(i, i + frameSize);
      const spectrum = math.fft(Array.from(frame));
      const mags = spectrum.map(c => math.sqrt(c.re ** 2 + c.im ** 2));
      const maxIdx = mags.indexOf(Math.max(...mags));
      const freq = (maxIdx * sampleRate) / frameSize;
      freqs.push(freq);
    }

    setFreqSeries(freqs);
  }, [monoData]);

  return { freqSeries };
}
