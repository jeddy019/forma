import { DIAGRAM_COLORS, SHADED_REGION_OPACITY } from './colors';
import { escapeSvgText } from './escapeSvgText';

export interface CircleAngleMark {
  degrees: number;
  label?: string;
}

export interface CircleSector {
  startDegrees: number;
  endDegrees: number;
}

const DRAWN_RADIUS = 80;
const PADDING = 28;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

export function drawCircle(
  radius: number,
  label?: string,
  angles: CircleAngleMark[] = [],
  sectors: CircleSector[] = []
): string {
  const size = DRAWN_RADIUS * 2 + PADDING * 2;
  const center = { x: size / 2, y: size / 2 };

  const sectorsSvg = sectors.map((sector) => {
    const start = polarToCartesian(center.x, center.y, DRAWN_RADIUS, sector.startDegrees);
    const end = polarToCartesian(center.x, center.y, DRAWN_RADIUS, sector.endDegrees);
    const sweep = ((sector.endDegrees - sector.startDegrees) % 360 + 360) % 360;
    const largeArc = sweep > 180 ? 1 : 0;
    return `<path d="M ${center.x} ${center.y} L ${start.x} ${start.y} A ${DRAWN_RADIUS} ${DRAWN_RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y} Z" fill="${DIAGRAM_COLORS.shadedRegion}" opacity="${SHADED_REGION_OPACITY}" />`;
  });

  const anglesSvg = angles.flatMap((angle) => {
    const end = polarToCartesian(center.x, center.y, DRAWN_RADIUS, angle.degrees);
    const line = `<line x1="${center.x}" y1="${center.y}" x2="${end.x}" y2="${end.y}" stroke="${DIAGRAM_COLORS.axis}" stroke-width="1" stroke-dasharray="3 2" />`;
    if (!angle.label) return [line];
    const labelPos = polarToCartesian(center.x, center.y, DRAWN_RADIUS * 0.35, angle.degrees);
    const text = `<text x="${labelPos.x}" y="${labelPos.y}" font-family="Inter, sans-serif" font-size="10" fill="${DIAGRAM_COLORS.axis}" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(angle.label)}</text>`;
    return [line, text];
  });

  const radiusEnd = polarToCartesian(center.x, center.y, DRAWN_RADIUS, 0);
  const radiusLine = `<line x1="${center.x}" y1="${center.y}" x2="${radiusEnd.x}" y2="${radiusEnd.y}" stroke="${DIAGRAM_COLORS.shapeStroke}" stroke-width="1.5" />
<text x="${(center.x + radiusEnd.x) / 2}" y="${center.y - 8}" font-family="Inter, sans-serif" font-size="11" fill="${DIAGRAM_COLORS.text}" text-anchor="middle">${radius}</text>`;

  const centerLabel = label
    ? `<text x="${center.x}" y="${center.y - 12}" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${DIAGRAM_COLORS.text}" text-anchor="middle">${escapeSvgText(label)}</text>`
    : '';
  const centerDot = `<circle cx="${center.x}" cy="${center.y}" r="2.5" fill="${DIAGRAM_COLORS.shapeStroke}" />`;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
<circle cx="${center.x}" cy="${center.y}" r="${DRAWN_RADIUS}" fill="${DIAGRAM_COLORS.shapeFill}" stroke="${DIAGRAM_COLORS.shapeStroke}" stroke-width="1.5" />
${sectorsSvg.join('\n')}
${anglesSvg.join('\n')}
${radiusLine}
${centerDot}
${centerLabel}
</svg>`;
}
