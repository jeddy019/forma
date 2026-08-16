// Diagram Colour System - see CLAUDE.md for the full spec these values match.

export const DIAGRAM_COLORS = {
  axis: '#1A3D2E',
  gridLine: '#E0D9D0',
  keyPoint: '#C0392B',
  primaryLine: '#1A3D2E',
  secondaryLine: '#C8A84B',
  shadedRegion: '#C8A84B',
  shapeFill: '#E8F2ED',
  shapeStroke: '#1A3D2E',
  barPrimary: '#1A3D2E',
  barSecondary: '#C8A84B',
  pieCycle: ['#1A3D2E', '#C8A84B', '#2D6A4F', '#E8F2ED'],
  numberLine: '#1A3D2E',
  numberLineHighlight: '#C0392B',
  tableBorder: '#C4B9AC',
  tableHeaderBg: '#1A3D2E',
  tableHeaderText: '#FFFFFF',
  text: '#1A1A18',
  textMuted: '#5C5849',
} as const;

export const SHADED_REGION_OPACITY = 0.18;
