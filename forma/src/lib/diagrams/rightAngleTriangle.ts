import { DIAGRAM_COLORS } from './colors';

export type RightTriangleSide = 'base' | 'height' | 'hypotenuse';

const PADDING = 32;
const MAX_DRAWN_SIZE = 140;
const RIGHT_ANGLE_MARK_SIZE = 10;

// Right angle sits at the bottom-left. base runs along the bottom,
// height runs up the left side, hypotenuse connects their far ends.
export function drawRightAngleTriangle(
  base: number,
  height: number,
  hypotenuse: number,
  labelledSide: RightTriangleSide
): string {
  const scale = MAX_DRAWN_SIZE / Math.max(base, height);
  const drawnBase = base * scale;
  const drawnHeight = height * scale;

  const svgWidth = drawnBase + PADDING * 2;
  const svgHeight = drawnHeight + PADDING * 2;

  const origin = { x: PADDING, y: svgHeight - PADDING };
  const baseEnd = { x: PADDING + drawnBase, y: svgHeight - PADDING };
  const heightEnd = { x: PADDING, y: svgHeight - PADDING - drawnHeight };

  const pathData = `M ${origin.x} ${origin.y} L ${baseEnd.x} ${baseEnd.y} L ${heightEnd.x} ${heightEnd.y} Z`;

  const rightAngleMark = `<path d="M ${origin.x} ${origin.y - RIGHT_ANGLE_MARK_SIZE} L ${origin.x + RIGHT_ANGLE_MARK_SIZE} ${origin.y - RIGHT_ANGLE_MARK_SIZE} L ${origin.x + RIGHT_ANGLE_MARK_SIZE} ${origin.y}" fill="none" stroke="${DIAGRAM_COLORS.shapeStroke}" stroke-width="1.5" />`;

  const label = (side: RightTriangleSide, value: number) => (side === labelledSide ? '?' : String(value));

  const baseLabel = `<text x="${(origin.x + baseEnd.x) / 2}" y="${origin.y + 16}" font-family="Inter, sans-serif" font-size="11" fill="${DIAGRAM_COLORS.text}" text-anchor="middle">${label('base', base)}</text>`;
  const heightLabel = `<text x="${origin.x - 10}" y="${(origin.y + heightEnd.y) / 2}" font-family="Inter, sans-serif" font-size="11" fill="${DIAGRAM_COLORS.text}" text-anchor="end" dominant-baseline="middle">${label('height', height)}</text>`;
  const hypMidX = (baseEnd.x + heightEnd.x) / 2;
  const hypMidY = (baseEnd.y + heightEnd.y) / 2;
  const hypotenuseLabel = `<text x="${hypMidX + 10}" y="${hypMidY - 6}" font-family="Inter, sans-serif" font-size="11" fill="${DIAGRAM_COLORS.text}" text-anchor="start">${label('hypotenuse', hypotenuse)}</text>`;

  return `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
<path d="${pathData}" fill="${DIAGRAM_COLORS.shapeFill}" stroke="${DIAGRAM_COLORS.shapeStroke}" stroke-width="1.5" stroke-linejoin="round" />
${rightAngleMark}
${baseLabel}
${heightLabel}
${hypotenuseLabel}
</svg>`;
}
