import sharp from 'sharp';
import type { DiagramSpec } from '../ai/schema';
import { renderDiagramSvg } from '../diagrams/renderDiagramSpec';

// The LaTeX PDF embeds diagrams as raster images rather than reimplementing
// the diagram library in TikZ. renderDiagramSvg() stays completely
// unchanged and remains the single dispatcher shared with the live
// /s/[code] student page (see its own comment on why that sharing matters)
// - this file is purely a consumer of its output, one rendering surface
// downstream of it, not a second diagram implementation.
//
// A 4x density scale is used rather than a fixed pixel size: these SVGs are
// already vector, so rasterizing at a high density and letting
// \includegraphics scale to the physical size the LaTeX template wants
// keeps print output visually indistinguishable from true vector at the
// diagram sizes this product actually uses (a few cm across, not full-page
// figures) - see CLAUDE.md's PDF print-quality requirements.
// Exported so callers (worksheetLatexTemplate.ts) can convert a rasterized
// diagram's pixel dimensions back to the physical mm size it was originally
// authored at, for \includegraphics sizing - see that file's mmFromPx().
export const RASTER_DENSITY = 384; // 4x the conventional 96dpi CSS-pixel baseline

export interface RasterizedDiagram {
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
}

// Returns null (never throws) on any failure - matches renderDiagramSpec.ts's
// own "a malformed diagram degrades to no diagram, not a crashed page"
// convention. One bad diagram_spec must not fail the whole PDF.
export async function renderDiagramToPng(spec: DiagramSpec): Promise<RasterizedDiagram | null> {
  try {
    const svg = renderDiagramSvg(spec);
    if (!svg) return null;

    const image = sharp(Buffer.from(svg), { density: RASTER_DENSITY });
    const metadata = await image.metadata();
    const buffer = await image.png().toBuffer();

    if (!metadata.width || !metadata.height) return null;
    return { buffer, widthPx: metadata.width, heightPx: metadata.height };
  } catch (error) {
    console.error('Failed to rasterize diagram', spec.type, error);
    return null;
  }
}
