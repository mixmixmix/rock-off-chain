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
export function chartData(freqSeries) {
  return {
    labels: freqSeries.map((_, i) => (i * 512 / 44100).toFixed(2)), // time in seconds
    datasets: [{
      label: 'Dominant Frequency (Hz)',
      data: freqSeries,
      borderWidth: 1,
      tension: 0.2,
      pointRadius: 0,
    }],
  };
}

// Chart.js options
export const chartOptions = {
  scales: {
    y: {
      type: 'logarithmic',
      ticks: {
        callback: (val) => `${val} Hz`,
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
