import { useState, useEffect } from 'react';
import { create, all } from 'mathjs';

const math = create(all);
const PIANO_MAX_FREQ = 4186; // C8

export function useAudioAnalysis(monoData, sampleRate = 44100) {
  const [freqSeries, setFreqSeries] = useState([]);
  const [silentFrames, setSilentFrames] = useState([]);

  useEffect(() => {
    if (!monoData) return;

    const frameSize = 1024;
    const hopSize = 512;
    const threshold = 0.0001;
    const freqs = [];
    const silents = [];

    for (let i = 0; i + frameSize <= monoData.length; i += hopSize) {
      const frame = monoData.slice(i, i + frameSize);
      const energy = frame.reduce((sum, v) => sum + v * v, 0) / frame.length;

      if (energy < threshold) {
        freqs.push(null);
        silents.push(true);
        continue;
      }

      const spectrum = math.fft(Array.from(frame));
      const mags = spectrum.map((c, i) => {
        const freq = (i * sampleRate) / frameSize;
        return freq > PIANO_MAX_FREQ ? 0 : math.sqrt(c.re ** 2 + c.im ** 2);
      });

      const maxIdx = mags.indexOf(Math.max(...mags));
      const freq = (maxIdx * sampleRate) / frameSize;
      freqs.push(freq);
      silents.push(false);
    }

    setFreqSeries(freqs);
    setSilentFrames(silents);
  }, [monoData]);

  return { freqSeries, silentFrames };
}
