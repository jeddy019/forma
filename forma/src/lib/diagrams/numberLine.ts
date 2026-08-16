import { DIAGRAM_COLORS } from './colors';

export interface NumberLineMarkedPoint {
  value: number;
  label?: string;
  filled?: boolean; // false draws an open circle (e.g. for a strict inequality)
}

export interface NumberLineArrow {
  from: number;
  to?: number; // omit for an open-ended ray in `direction`
  direction?: 'left' | 'right';
}

const CELL_SIZE = 32;
const PADDING = 20;
const LINE_Y = 36;
const ARROW_LENGTH = 14;

export function drawNumberLine(
  min: number,
  max: number,
  markedPoints: NumberLineMarkedPoint[] = [],
  arrows: NumberLineArrow[] = []
): string {
  const width = (max - min) * CELL_SIZE + PADDING * 2;
  const height = 68;

  const toSvgX = (value: number) => PADDING + (value - min) * CELL_SIZE;

  const ticks: string[] = [];
  for (let v = min; v <= max; v++) {
    const x = toSvgX(v);
    ticks.push(
      `<line x1="${x}" y1="${LINE_Y - 5}" x2="${x}" y2="${LINE_Y + 5}" stroke="${DIAGRAM_COLORS.numberLine}" stroke-width="1" />
<text x="${x}" y="${LINE_Y + 20}" font-family="Inter, sans-serif" font-size="10" fill="${DIAGRAM_COLORS.textMuted}" text-anchor="middle">${v}</text>`
    );
  }

  const arrowsSvg = arrows.map((arrow) => {
    const fromX = toSvgX(arrow.from);
    let toX: number;
    if (arrow.to !== undefined) {
      toX = toSvgX(arrow.to);
    } else {
      toX = arrow.direction === 'left' ? PADDING - ARROW_LENGTH : width - PADDING + ARROW_LENGTH;
    }
    const pointsRight = toX >= fromX;
    const headX = pointsRight ? toX - 8 : toX + 8;
    const arrowHead = `<path d="M ${headX} ${LINE_Y - 5} L ${toX} ${LINE_Y} L ${headX} ${LINE_Y + 5}" fill="none" stroke="${DIAGRAM_COLORS.numberLine}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />`;
    return `<line x1="${fromX}" y1="${LINE_Y}" x2="${toX}" y2="${LINE_Y}" stroke="${DIAGRAM_COLORS.numberLine}" stroke-width="2" />
${arrowHead}`;
  });

  const points = markedPoints.flatMap((point) => {
    const x = toSvgX(point.value);
    const dot =
      point.filled === false
        ? `<circle cx="${x}" cy="${LINE_Y}" r="5" fill="#FFFFFF" stroke="${DIAGRAM_COLORS.numberLineHighlight}" stroke-width="2" />`
        : `<circle cx="${x}" cy="${LINE_Y}" r="5" fill="${DIAGRAM_COLORS.numberLineHighlight}" />`;
    if (!point.label) return [dot];
    const label = `<text x="${x}" y="${LINE_Y - 12}" font-family="Inter, sans-serif" font-size="10" fill="${DIAGRAM_COLORS.text}" text-anchor="middle">${point.label}</text>`;
    return [dot, label];
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<line x1="${PADDING}" y1="${LINE_Y}" x2="${width - PADDING}" y2="${LINE_Y}" stroke="${DIAGRAM_COLORS.numberLine}" stroke-width="1.5" />
${ticks.join('\n')}
${arrowsSvg.join('\n')}
${points.join('\n')}
</svg>`;
}
