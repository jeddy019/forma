import { DIAGRAM_COLORS } from './colors';
import { escapeSvgText } from './escapeSvgText';
import type { Point } from './types';

export interface TriangleAngleMark {
  vertex: 0 | 1 | 2;
  label: string;
}

export interface TriangleSideLength {
  side: 0 | 1 | 2; // 0: vertices[0]-vertices[1], 1: vertices[1]-vertices[2], 2: vertices[2]-vertices[0]
  label: string;
}

const PADDING = 28;
const SCALE = 24;

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function drawTriangle(
  vertices: [Point, Point, Point],
  labels?: [string, string, string],
  angleMarks: TriangleAngleMark[] = [],
  sideLengths: TriangleSideLength[] = []
): string {
  const xs = vertices.map((v) => v.x * SCALE);
  const ys = vertices.map((v) => v.y * SCALE);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const width = maxX - minX + PADDING * 2;
  const height = maxY - minY + PADDING * 2;

  const toSvg = (p: Point): Point => ({
    x: p.x * SCALE - minX + PADDING,
    y: height - (p.y * SCALE - minY + PADDING),
  });

  const svgVertices = vertices.map(toSvg);
  const pathData = `M ${svgVertices[0].x} ${svgVertices[0].y} L ${svgVertices[1].x} ${svgVertices[1].y} L ${svgVertices[2].x} ${svgVertices[2].y} Z`;

  const vertexLabels = (labels ?? []).map((label, i) => {
    if (!label) return '';
    const v = svgVertices[i];
    const cx = (svgVertices[0].x + svgVertices[1].x + svgVertices[2].x) / 3;
    const cy = (svgVertices[0].y + svgVertices[1].y + svgVertices[2].y) / 3;
    const dx = v.x - cx;
    const dy = v.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const lx = v.x + (dx / len) * 14;
    const ly = v.y + (dy / len) * 14;
    return `<text x="${lx}" y="${ly}" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.text}" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(label)}</text>`;
  });

  const angleLabels = angleMarks.map((mark) => {
    const v = svgVertices[mark.vertex];
    const others = [0, 1, 2].filter((i) => i !== mark.vertex).map((i) => svgVertices[i]);
    const dx = others[0].x + others[1].x - 2 * v.x;
    const dy = others[0].y + others[1].y - 2 * v.y;
    const len = Math.hypot(dx, dy) || 1;
    const lx = v.x + (dx / len) * 20;
    const ly = v.y + (dy / len) * 20;
    return `<text x="${lx}" y="${ly}" font-family="Inter, sans-serif" font-size="10" fill="${DIAGRAM_COLORS.axis}" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(mark.label)}</text>`;
  });

  const sideLabels = sideLengths.map((side) => {
    const a = svgVertices[side.side];
    const b = svgVertices[(side.side + 1) % 3];
    const m = midpoint(a, b);
    const other = svgVertices[(side.side + 2) % 3];
    const dx = m.x - other.x;
    const dy = m.y - other.y;
    const len = Math.hypot(dx, dy) || 1;
    const lx = m.x + (dx / len) * 14;
    const ly = m.y + (dy / len) * 14;
    return `<text x="${lx}" y="${ly}" font-family="Inter, sans-serif" font-size="10" fill="${DIAGRAM_COLORS.textMuted}" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(side.label)}</text>`;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<path d="${pathData}" fill="${DIAGRAM_COLORS.shapeFill}" stroke="${DIAGRAM_COLORS.shapeStroke}" stroke-width="1.5" stroke-linejoin="round" />
${vertexLabels.join('\n')}
${angleLabels.join('\n')}
${sideLabels.join('\n')}
</svg>`;
}
