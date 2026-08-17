import { DIAGRAM_COLORS } from './colors';
import { escapeSvgText } from './escapeSvgText';
import type { GridLine, GridPoint } from './types';

const CELL_SIZE = 30;
const PADDING = 32;

export function drawCoordinateGrid(
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  points: GridPoint[] = [],
  lines: GridLine[] = []
): string {
  const width = (xMax - xMin) * CELL_SIZE + PADDING * 2;
  const height = (yMax - yMin) * CELL_SIZE + PADDING * 2;

  const toSvgX = (x: number) => PADDING + (x - xMin) * CELL_SIZE;
  const toSvgY = (y: number) => height - PADDING - (y - yMin) * CELL_SIZE;

  const gridLines: string[] = [];
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
    const sx = toSvgX(x);
    gridLines.push(
      `<line x1="${sx}" y1="${PADDING}" x2="${sx}" y2="${height - PADDING}" stroke="${DIAGRAM_COLORS.gridLine}" stroke-width="0.5" />`
    );
  }
  for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
    const sy = toSvgY(y);
    gridLines.push(
      `<line x1="${PADDING}" y1="${sy}" x2="${width - PADDING}" y2="${sy}" stroke="${DIAGRAM_COLORS.gridLine}" stroke-width="0.5" />`
    );
  }

  const axes: string[] = [];
  if (xMin <= 0 && xMax >= 0) {
    const sx = toSvgX(0);
    axes.push(
      `<line x1="${sx}" y1="${PADDING}" x2="${sx}" y2="${height - PADDING}" stroke="${DIAGRAM_COLORS.axis}" stroke-width="1.5" />`
    );
  }
  if (yMin <= 0 && yMax >= 0) {
    const sy = toSvgY(0);
    axes.push(
      `<line x1="${PADDING}" y1="${sy}" x2="${width - PADDING}" y2="${sy}" stroke="${DIAGRAM_COLORS.axis}" stroke-width="1.5" />`
    );
  }

  const axisLabels: string[] = [];
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
    if (x === 0) continue;
    axisLabels.push(
      `<text x="${toSvgX(x)}" y="${height - PADDING + 14}" font-family="Inter, sans-serif" font-size="9" fill="${DIAGRAM_COLORS.textMuted}" text-anchor="middle">${x}</text>`
    );
  }
  for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
    if (y === 0) continue;
    axisLabels.push(
      `<text x="${PADDING - 8}" y="${toSvgY(y) + 3}" font-family="Inter, sans-serif" font-size="9" fill="${DIAGRAM_COLORS.textMuted}" text-anchor="end">${y}</text>`
    );
  }

  const linesSvg = lines.map((line) => {
    const color = line.style === 'secondary' ? DIAGRAM_COLORS.secondaryLine : DIAGRAM_COLORS.primaryLine;
    return `<line x1="${toSvgX(line.from.x)}" y1="${toSvgY(line.from.y)}" x2="${toSvgX(line.to.x)}" y2="${toSvgY(line.to.y)}" stroke="${color}" stroke-width="2" />`;
  });

  const pointsSvg = points.flatMap((point) => {
    const sx = toSvgX(point.x);
    const sy = toSvgY(point.y);
    const dot = `<circle cx="${sx}" cy="${sy}" r="4" fill="${DIAGRAM_COLORS.keyPoint}" />`;
    if (!point.label) return [dot];
    const label = `<text x="${sx + 8}" y="${sy - 8}" font-family="Inter, sans-serif" font-size="11" fill="${DIAGRAM_COLORS.text}">${escapeSvgText(point.label)}</text>`;
    return [dot, label];
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
${gridLines.join('\n')}
${axes.join('\n')}
${axisLabels.join('\n')}
${linesSvg.join('\n')}
${pointsSvg.join('\n')}
</svg>`;
}
