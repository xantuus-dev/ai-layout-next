/**
 * Chart HTML Template
 *
 * Builds a self-contained HTML page that draws one Chart.js chart on a
 * canvas. Chart.js is inlined from node_modules rather than loaded from a
 * CDN `<script>` tag, so rendering doesn't depend on outbound network access
 * from within the headless page at request time.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { getTheme, hex as themeHex } from './document-theme';

export interface ChartRenderSpec {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';
  title: string;
  labels: string[];
  series: { name: string; data: number[] }[];
  width: number;
  height: number;
  /** Named theme preset (see document-theme.ts); defaults to 'default'. */
  theme?: string;
}

/** Extra palette entries for series beyond the first, cycling as needed. */
const SERIES_COLORS = ['0D9488', '2563EB', 'D97706', 'DC2626', '7C3AED', '059669'];

let cachedChartJsSource: string | null = null;

function loadChartJsSource(): string {
  if (!cachedChartJsSource) {
    // chart.js's package.json "exports" map doesn't list the UMD bundle, so
    // require.resolve('chart.js/dist/chart.umd.js') is rejected even though
    // the file exists on disk. Resolve the package root via the main entry
    // (which IS exported) and join the UMD path manually instead.
    const pkgEntry = require.resolve('chart.js');
    const pkgRoot = dirname(dirname(pkgEntry)); // .../node_modules/chart.js/dist/chart.cjs -> .../chart.js
    cachedChartJsSource = readFileSync(join(pkgRoot, 'dist', 'chart.umd.js'), 'utf-8');
  }
  return cachedChartJsSource;
}

const hex = themeHex;

function buildDatasets(spec: ChartRenderSpec): any[] {
  const isPieLike = spec.type === 'pie' || spec.type === 'doughnut';

  return spec.series.map((s, i) => {
    if (isPieLike) {
      // Pie/doughnut color by slice (label), not by series.
      return {
        label: s.name,
        data: s.data,
        backgroundColor: spec.labels.map((_, j) => hex(SERIES_COLORS[j % SERIES_COLORS.length])),
      };
    }
    const color = hex(SERIES_COLORS[i % SERIES_COLORS.length]);
    return {
      label: s.name,
      data: s.data,
      backgroundColor: spec.type === 'line' ? 'transparent' : color,
      borderColor: color,
      borderWidth: spec.type === 'line' ? 3 : 1,
      tension: spec.type === 'line' ? 0.3 : 0,
      pointRadius: spec.type === 'line' ? 3 : undefined,
    };
  });
}

export function buildChartHtml(spec: ChartRenderSpec): string {
  const theme = getTheme(spec.theme);
  const chartJsSource = loadChartJsSource();

  const config = {
    type: spec.type,
    data: {
      labels: spec.labels,
      datasets: buildDatasets(spec),
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: Boolean(spec.title),
          text: spec.title,
          color: hex(theme.dark),
          font: { size: 18, weight: 'bold' },
          padding: { bottom: 16 },
        },
        legend: {
          display: spec.series.length > 1 || spec.type === 'pie' || spec.type === 'doughnut',
          labels: { color: hex(theme.body) },
        },
      },
      scales:
        spec.type === 'pie' || spec.type === 'doughnut'
          ? undefined
          : {
              x: { ticks: { color: hex(theme.body) }, grid: { color: '#E2E8F0' } },
              y: { ticks: { color: hex(theme.body) }, grid: { color: '#E2E8F0' }, beginAtZero: true },
            },
    },
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; background: #ffffff; }
  #canvas-wrap { width: ${spec.width}px; height: ${spec.height}px; }
</style>
</head>
<body>
<div id="canvas-wrap"><canvas id="chart" width="${spec.width}" height="${spec.height}"></canvas></div>
<script>${chartJsSource}</script>
<script>
  const ctx = document.getElementById('chart').getContext('2d');
  new Chart(ctx, ${JSON.stringify(config)});
  window.__chartReady = true;
</script>
</body>
</html>`;
}
