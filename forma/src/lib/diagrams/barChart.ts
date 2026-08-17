import { DIAGRAM_COLORS } from './colors';
import { escapeSvgText } from './escapeSvgText';

const CHART_HEIGHT = 180;
const BAR_WIDTH = 44;
const BAR_GAP = 20;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 36;
const PADDING_SIDE = 24;

export function drawBarChart(
  labels: string[],
  values: number[],
  colours: ('primary' | 'secondary')[] = []
): string {
  const maxValue = Math.max(...values, 1);
  const width = labels.length * (BAR_WIDTH + BAR_GAP) + PADDING_SIDE * 2 - BAR_GAP;
  const height = CHART_HEIGHT + PADDING_TOP + PADDING_BOTTOM;
  const baselineY = height - PADDING_BOTTOM;

  const bars = values.map((value, i) => {
    const barHeight = (value / maxValue) * CHART_HEIGHT;
    const x = PADDING_SIDE + i * (BAR_WIDTH + BAR_GAP);
    const y = baselineY - barHeight;
    const color = colours[i] === 'secondary' ? DIAGRAM_COLORS.barSecondary : DIAGRAM_COLORS.barPrimary;

    return `<rect x="${x}" y="${y}" width="${BAR_WIDTH}" height="${barHeight}" fill="${color}" />
<text x="${x + BAR_WIDTH / 2}" y="${y - 6}" font-family="Inter, sans-serif" font-size="10" fill="${DIAGRAM_COLORS.text}" text-anchor="middle">${value}</text>
<text x="${x + BAR_WIDTH / 2}" y="${baselineY + 16}" font-family="Inter, sans-serif" font-size="10" fill="${DIAGRAM_COLORS.textMuted}" text-anchor="middle">${escapeSvgText(labels[i])}</text>`;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<line x1="${PADDING_SIDE - 8}" y1="${baselineY}" x2="${width - PADDING_SIDE + 8}" y2="${baselineY}" stroke="${DIAGRAM_COLORS.axis}" stroke-width="1.5" />
${bars.join('\n')}
</svg>`;
}
