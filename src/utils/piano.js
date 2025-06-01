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

// Get note number (0-11) from frequency
function freqToNoteNumber(freq) {
  if (!freq || freq <= 0) return null;
  const A4 = 440;
  const n = Math.round(12 * Math.log2(freq / A4)) + 57;
  return n % 12;
}

// Check if three notes form a minor chord
function checkMinorChord(noteNumbers) {
  if (noteNumbers.length < 3) {
    console.log('🎼 Not enough notes for minor chord detection (need 3)');
    return false;
  }
  
  // Sort note numbers
  const sorted = [...noteNumbers].sort((a, b) => a - b);
  console.log('🎹 Checking for minor chord with notes:', sorted.map(n => ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][n]));
  
  // Check for minor third (3 semitones) and perfect fifth (7 semitones)
  const hasMinorThird = sorted.some((note, i) => {
    const nextNote = sorted[(i + 1) % sorted.length];
    const interval = (nextNote - note + 12) % 12;
    console.log(`🎵 Checking interval ${note} to ${nextNote}: ${interval} semitones`);
    return interval === 3;
  });
  
  const hasPerfectFifth = sorted.some((note, i) => {
    const nextNote = sorted[(i + 2) % sorted.length];
    const interval = (nextNote - note + 12) % 12;
    console.log(`🎵 Checking interval ${note} to ${nextNote}: ${interval} semitones`);
    return interval === 7;
  });
  
  console.log('🎼 Minor chord analysis:', {
    hasMinorThird,
    hasPerfectFifth,
    isMinorChord: hasMinorThird && hasPerfectFifth
  });
  
  return hasMinorThird && hasPerfectFifth;
}

// Check if notes contain a perfect fifth
function checkPerfectFifth(noteNumbers) {
  if (noteNumbers.length < 2) {
    console.log('🎼 Not enough notes for perfect fifth detection (need 2)');
    return false;
  }
  
  // Sort note numbers
  const sorted = [...noteNumbers].sort((a, b) => a - b);
  console.log('🎹 Checking for perfect fifth with notes:', sorted.map(n => ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][n]));
  
  // Check for perfect fifth (7 semitones)
  const hasFifth = sorted.some((note, i) => {
    const nextNote = sorted[(i + 1) % sorted.length];
    const interval = (nextNote - note + 12) % 12;
    console.log(`🎵 Checking interval ${note} to ${nextNote}: ${interval} semitones`);
    return interval === 7;
  });
  
  console.log('🎼 Perfect fifth analysis:', {
    hasPerfectFifth: hasFifth
  });
  
  return hasFifth;
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

  console.log('📊 Rolling median result:', result);
  return result;
}

// Extract most common frequencies quantised into 500 bins
export function mostCommonFrequencies(freqSeries, binCount = 1000, minFreq = 20, maxFreq = 20000) {
  const binWidth = (maxFreq - minFreq) / binCount;
  const counts = new Array(binCount).fill(0);
  let total = 0;

  console.log('📏 Bin width:', binWidth);

  for (const freq of freqSeries) {
    if (!freq || freq < minFreq || freq > maxFreq) continue;
    const binIdx = Math.floor((freq - minFreq) / binWidth);
    counts[binIdx]++;
    total++;
  }

  console.log('📈 Raw bin counts:', counts);

  const result = counts
    .map((count, i) => ({
      freq: Math.round(minFreq + (i + 0.5) * binWidth),
      count,
      proportion: count / total,
    }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);

  console.log('🎵 Sorted dominant frequencies:', result);

  return result;
}

function horizontalLines(frequencies, colorList, freqSeries) {
  console.log('📐 Generating horizontal lines for frequencies:', frequencies);
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
  if (!freqSeries || freqSeries.length === 0) {
    console.log('🎼 No frequency data available for analysis');
    return {
      labels: [],
      datasets: [],
      commonFreqs: [],
      noteSeries: [],
      topNotes: [],
      isMinorChord: false,
      hasPerfectFifth: false
    };
  }

  console.log('🎼 Original frequency series:', freqSeries);
  const smoothed = rollingMedian(freqSeries, 3);
  const filtered = smoothed.filter(f => f != null);
  const commonFreqs = mostCommonFrequencies(filtered).filter(f => f.proportion > 0.1);
  console.log('🎯 Top frequencies:', commonFreqs.map(f => ({
    freq: f.freq,
    note: freqToNote(f.freq),
    proportion: f.proportion
  })));

  // Get top 3 note numbers for chord detection
  const topNoteNumbers = commonFreqs
    .slice(0, 3)
    .map(f => freqToNoteNumber(f.freq))
    .filter(n => n !== null);
  
  console.log('🎹 Top note numbers:', topNoteNumbers);
  
  const isMinorChord = checkMinorChord(topNoteNumbers);
  const hasPerfectFifth = checkPerfectFifth(topNoteNumbers);
  
  console.log('🎼 Final analysis results:', {
    isMinorChord,
    hasPerfectFifth,
    topNotes: topNoteNumbers.map(n => ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][n])
  });

  const baseColor = 'rgba(30, 144, 255, 0.8)';
  const highlightColors = ['#fbaacb', '#56b3c3', '#ffb547', '#b2b2b2', '#6c6c6c'];

  const labels = freqSeries.map((_, i) => (i * 512 / 44100).toFixed(2));
  console.log('⏱️ Time labels:', labels);

  const noteSeries = filtered.map(freqToNote);
  console.log('🎹 Musical notes played:', noteSeries);

  const topNotes = commonFreqs.map(f => ({
    freq: f.freq,
    note: freqToNote(f.freq),
    proportion: f.proportion,
  }));
  console.log('🏆 Top notes:', topNotes);

  const datasets = [
    {
      label: 'Smoothed Dominant Frequency (Hz)',
      data: smoothed,
      borderColor: baseColor,
      backgroundColor: 'rgba(30, 144, 255, 0.2)',
      borderWidth: 0,
      tension: 0,
      pointRadius: 4,
      pointHoverRadius: 6,
      showLine: false
    },
    ...horizontalLines(commonFreqs, highlightColors, freqSeries),
    {
      label: 'Top Notes',
      data: commonFreqs.map(f => ({ x: 0, y: f.freq })),
      pointRadius: 6,
      pointHoverRadius: 8,
      borderWidth: 0,
      showLine: false,
      backgroundColor: 'rgba(255,255,255,0.5)',
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const freq = ctx.raw.y;
            return `${freq} Hz (${freqToNote(freq)})`;
          }
        }
      }
    }
  ];

  console.log('📊 Final datasets:', datasets);

  return {
    labels,
    datasets,
    commonFreqs,
    noteSeries,
    topNotes,
    isMinorChord,
    hasPerfectFifth
  };
}

// Dynamic Chart.js options with annotations and right-hand note axis
export function generateChartOptions(commonFreqs) {
  const highlightColors = ['#fbaacb', '#56b3c3', '#ffb547', '#b2b2b2', '#6c6c6c'];

  return {
    scales: {
      y: {
        type: 'logarithmic',
        min: 100,
        max: 2000,
        position: 'left',
        ticks: {
          callback: (val) => `${val} Hz`,
        },
      },
      yNote: {
        type: 'logarithmic',
        min: 100,
        max: 2000,
        position: 'right',
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: (val) => freqToNote(val),
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
