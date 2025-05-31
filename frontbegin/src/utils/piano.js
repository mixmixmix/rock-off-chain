import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'chart.js';

Chart.register(annotationPlugin);

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

// Rolling median smoother
function rollingMedian(arr, window = 3) {
  const half = Math.floor(window / 2);
  const result = [];

  for (let i = 0; i < arr.length; i++) {
    const windowVals = arr.slice(Math.max(0, i - half), i + half + 1).filter(v => v);
    const sorted = windowVals.sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    result.push(median);
  }

  console.log('Rolling median result:', result);
  return result;
}

// Extract most common frequencies quantised into 500 bins
export function mostCommonFrequencies(freqSeries, binCount = 500, minFreq = 20, maxFreq = 20000) {
  const binWidth = (maxFreq - minFreq) / binCount;
  const counts = new Array(binCount).fill(0);
  let total = 0;

  console.log('Bin width:', binWidth);

  for (const freq of freqSeries) {
    if (!freq || freq < minFreq || freq > maxFreq) continue;
    const binIdx = Math.floor((freq - minFreq) / binWidth);
    counts[binIdx]++;
    total++;
  }

  console.log('Raw bin counts:', counts);

  const result = counts
    .map((count, i) => ({
      freq: Math.round(minFreq + (i + 0.5) * binWidth),
      count,
      proportion: count / total,
    }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);

  console.log('Sorted dominant frequencies:', result);

  return result;
}

function horizontalLines(frequencies, colorList, freqSeries) {
  console.log('Generating horizontal lines for frequencies:', frequencies);
  return frequencies.map((f, i) => ({
    label: `~${f.freq} Hz (${freqToNote(f.freq)})`,
    data: freqSeries.map((_, j) => ({
      x: (j * 512 / 44100).toFixed(2),
      y: f.freq,
    })),
    borderColor: colorList[i % colorList.length],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
    showLine: true,
  }));
}

// Chart data generator
export function chartData(freqSeries) {
  console.log('Original frequency series:', freqSeries);
  const smoothed = rollingMedian(freqSeries, 3);
  const filtered = smoothed.filter(f => f != null);
  const commonFreqs = mostCommonFrequencies(filtered).filter(f => f.proportion > 0.1);
  console.log('Frequencies >10%:', commonFreqs);

  const baseColor = 'rgba(30, 144, 255, 0.8)';
  const highlightColors = ['#fbaacb', '#56b3c3', '#ffb547', '#b2b2b2', '#6c6c6c'];

  const labels = freqSeries.map((_, i) => (i * 512 / 44100).toFixed(2));
  console.log('Time labels:', labels);

  const datasets = [
    {
      label: 'Smoothed Dominant Frequency (Hz)',
      data: smoothed,
      borderColor: baseColor,
      backgroundColor: 'rgba(30, 144, 255, 0.2)',
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 2,
    },
    ...horizontalLines(commonFreqs, highlightColors, freqSeries)
  ];

  console.log('Final datasets:', datasets);

  return {
    labels,
    datasets,
    commonFreqs, // return this for annotation
  };
}

// Dynamic Chart.js options with annotations
export function generateChartOptions(commonFreqs) {
  const highlightColors = ['#fbaacb', '#56b3c3', '#ffb547', '#b2b2b2', '#6c6c6c'];

  return {
    scales: {
      y: {
        type: 'logarithmic',
        min: 100,
        max: 2000,
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
            return `${freq?.toFixed(1)} Hz (${note})`;
          },
        },
      },
      annotation: {
        annotations: commonFreqs.reduce((acc, f, i) => {
          acc[`line${i}`] = {
            type: 'line',
            yMin: f.freq,
            yMax: f.freq,
            borderColor: highlightColors[i % highlightColors.length],
            borderWidth: 1.5,
            label: {
              content: `${freqToNote(f.freq)}`,
              enabled: true,
              position: 'start',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#fff',
              font: {
                weight: 'bold',
                size: 10
              },
            },
          };
          return acc;
        }, {}),
      },
    },
  };
}
