// Piano note mapping
export function freqToNote(freq) {
  if (!freq || freq <= 0) return '—';
  const A4 = 440;
  const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const n = Math.round(12 * Math.log2(freq / A4)) + 57;
  const note = noteNames[n % 12];
  const octave = Math.floor(n / 12);
  return `${note}${octave}`;
}

// Chart data generator
export function chartData(freqSeries, silentFrames = []) {
  return {
    labels: freqSeries.map((_, i) => (i * 512 / 44100).toFixed(2)),
    datasets: [{
      label: 'Dominant Frequency (Hz)',
      data: freqSeries.map((f, i) => silentFrames[i] ? null : f),
      borderWidth: 2, // thicker line
      tension: 0.2,
      pointRadius: 2.5, // larger points
      spanGaps: true,
    }],
  };
}

// Chart.js options with piano notes and Hz
export const chartOptions = {
  scales: {
    y: {
      type: 'logarithmic',
      ticks: {
        callback: (val) => {
          const note = freqToNote(val);
          return `${val} Hz (${note})`;
        },
      },
    },
  },
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const freq = ctx.raw;
          const note = freqToNote(freq);
          return `${freq.toFixed(1)} Hz (${note})`;
        },
      },
    },
  },
};
