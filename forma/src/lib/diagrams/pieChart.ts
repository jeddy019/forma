import { DIAGRAM_COLORS } from './colors';
import { escapeSvgText } from './escapeSvgText';

const RADIUS = 90;
const CENTER = RADIUS + 10;
const LEGEND_WIDTH = 140;
const LEGEND_ROW_HEIGHT = 20;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function drawPieChart(labels: string[], values: number[]): string {
  const total = values.reduce((sum, v) => sum + v, 0) || 1;
  const height = Math.max(CENTER * 2, labels.length * LEGEND_ROW_HEIGHT + 20);
  const width = CENTER * 2 + LEGEND_WIDTH;

  let startAngle = 0;
  const slices: string[] = [];
  const legend: string[] = [];

  values.forEach((value, i) => {
    const color = DIAGRAM_COLORS.pieCycle[i % DIAGRAM_COLORS.pieCycle.length];
    const sweep = (value / total) * 360;
    const endAngle = startAngle + sweep;
    const largeArc = sweep > 180 ? 1 : 0;

    const start = polarToCartesian(CENTER, CENTER, RADIUS, startAngle);
    const end = polarToCartesian(CENTER, CENTER, RADIUS, endAngle);

    slices.push(
      `<path d="M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z" fill="${color}" stroke="#FFFFFF" stroke-width="1" />`
    );

    const legendY = 10 + i * LEGEND_ROW_HEIGHT;
    legend.push(
      `<rect x="${CENTER * 2 + 16}" y="${legendY}" width="10" height="10" fill="${color}" />
<text x="${CENTER * 2 + 32}" y="${legendY + 9}" font-family="Inter, sans-serif" font-size="10" fill="${DIAGRAM_COLORS.text}">${escapeSvgText(labels[i])}</text>`
    );

    startAngle = endAngle;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
${slices.join('\n')}
${legend.join('\n')}
</svg>`;
}
