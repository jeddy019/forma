import type { DiagramSpec } from '../ai/schema';
import {
  drawCoordinateGrid,
  drawTriangle,
  drawRightAngleTriangle,
  drawBarChart,
  drawPieChart,
  drawNumberLine,
  drawCircle,
  drawTable,
} from './index';
import type {
  GridPoint,
  GridLine,
  TriangleAngleMark,
  TriangleSideLength,
  RightTriangleSide,
  NumberLineMarkedPoint,
  NumberLineArrow,
  CircleAngleMark,
  CircleSector,
} from './index';

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(params: Record<string, unknown>, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === 'string' ? value : fallback;
}

// Maps diagram_spec (loosely typed per the AI JSON schema, see
// src/lib/ai/schema.ts) onto the typed functions in src/lib/diagrams/.
// Shared by worksheet-template.ts (PDF, via Puppeteer) and the /s/[code]
// student page (a real browser) - one dispatcher, so the two surfaces can
// never silently diverge on how a diagram_spec is interpreted. Wrapped in
// try/catch so one malformed diagram_spec from the model doesn't take down
// the whole render - it just renders as a gap. Individual diagram functions
// already escape any label/text values they embed (see escapeSvgText.ts).
export function renderDiagramSvg(spec: DiagramSpec): string {
  try {
    // spec.params is a JSON-encoded string, not a nested object - see the
    // comment above DIAGRAM_SPEC_SCHEMA in src/lib/ai/schema.ts for why. A
    // malformed or non-object string (JSON.parse throwing, or parsing to a
    // non-object) falls through to the outer catch below exactly like a
    // malformed object always did - render as a gap, not a crash.
    const parsed: unknown = JSON.parse(spec.params);
    const p = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    switch (spec.type) {
      case 'coordinate_grid':
        return drawCoordinateGrid(
          num(p, 'xMin', -5),
          num(p, 'xMax', 5),
          num(p, 'yMin', -5),
          num(p, 'yMax', 5),
          Array.isArray(p.points) ? (p.points as GridPoint[]) : [],
          Array.isArray(p.lines) ? (p.lines as GridLine[]) : []
        );
      case 'triangle':
        return drawTriangle(
          (Array.isArray(p.vertices) && p.vertices.length === 3
            ? p.vertices
            : [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 0, y: 3 },
              ]) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
          Array.isArray(p.labels) && p.labels.length === 3 ? (p.labels as [string, string, string]) : undefined,
          Array.isArray(p.angleMarks) ? (p.angleMarks as TriangleAngleMark[]) : [],
          Array.isArray(p.sideLengths) ? (p.sideLengths as TriangleSideLength[]) : []
        );
      case 'right_angle':
        return drawRightAngleTriangle(
          num(p, 'base', 4),
          num(p, 'height', 3),
          num(p, 'hypotenuse', 5),
          str(p, 'labelledSide', 'hypotenuse') as RightTriangleSide
        );
      case 'bar_chart':
        return drawBarChart(
          Array.isArray(p.labels) ? (p.labels as string[]) : [],
          Array.isArray(p.values) ? (p.values as number[]) : [],
          Array.isArray(p.colours) ? (p.colours as ('primary' | 'secondary')[]) : []
        );
      case 'pie_chart':
        return drawPieChart(
          Array.isArray(p.labels) ? (p.labels as string[]) : [],
          Array.isArray(p.values) ? (p.values as number[]) : []
        );
      case 'number_line':
        return drawNumberLine(
          num(p, 'min', -5),
          num(p, 'max', 5),
          Array.isArray(p.markedPoints) ? (p.markedPoints as NumberLineMarkedPoint[]) : [],
          Array.isArray(p.arrows) ? (p.arrows as NumberLineArrow[]) : []
        );
      case 'circle':
        return drawCircle(
          num(p, 'radius', 5),
          typeof p.label === 'string' ? p.label : undefined,
          Array.isArray(p.angles) ? (p.angles as CircleAngleMark[]) : [],
          Array.isArray(p.sectors) ? (p.sectors as CircleSector[]) : []
        );
      case 'table':
        return drawTable(
          Array.isArray(p.headers) ? (p.headers as string[]) : [],
          Array.isArray(p.rows) ? (p.rows as string[][]) : []
        );
      default:
        return '';
    }
  } catch (error) {
    console.error('Failed to render diagram', spec.type, error);
    return '';
  }
}
