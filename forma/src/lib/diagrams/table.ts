import { DIAGRAM_COLORS } from './colors';

const ROW_HEIGHT = 28;
const MIN_COL_WIDTH = 70;
const CHAR_WIDTH = 7;
const CELL_PADDING = 10;

export function drawTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((header, i) => {
    const cellsInColumn = [header, ...rows.map((row) => row[i] ?? '')];
    const longest = Math.max(...cellsInColumn.map((cell) => cell.length));
    return Math.max(MIN_COL_WIDTH, longest * CHAR_WIDTH + CELL_PADDING * 2);
  });

  const colX = colWidths.reduce<number[]>((acc, w, i) => [...acc, (acc[i - 1] ?? 0) + (i === 0 ? 0 : colWidths[i - 1])], []);
  const width = colWidths.reduce((sum, w) => sum + w, 0);
  const height = ROW_HEIGHT * (rows.length + 1);

  const headerCells = headers.map(
    (header, i) =>
      `<rect x="${colX[i]}" y="0" width="${colWidths[i]}" height="${ROW_HEIGHT}" fill="${DIAGRAM_COLORS.tableHeaderBg}" stroke="${DIAGRAM_COLORS.tableBorder}" stroke-width="0.5" />
<text x="${colX[i] + colWidths[i] / 2}" y="${ROW_HEIGHT / 2 + 4}" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="${DIAGRAM_COLORS.tableHeaderText}" text-anchor="middle">${header}</text>`
  );

  const bodyCells = rows.flatMap((row, rowIndex) => {
    const y = ROW_HEIGHT * (rowIndex + 1);
    return row.map(
      (cell, colIndex) =>
        `<rect x="${colX[colIndex]}" y="${y}" width="${colWidths[colIndex]}" height="${ROW_HEIGHT}" fill="#FFFFFF" stroke="${DIAGRAM_COLORS.tableBorder}" stroke-width="0.5" />
<text x="${colX[colIndex] + colWidths[colIndex] / 2}" y="${y + ROW_HEIGHT / 2 + 4}" font-family="Inter, sans-serif" font-size="11" fill="${DIAGRAM_COLORS.text}" text-anchor="middle">${cell}</text>`
    );
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
${headerCells.join('\n')}
${bodyCells.join('\n')}
</svg>`;
}
