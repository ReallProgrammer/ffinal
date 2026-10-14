import type { CoverLayer } from './types';
let measure: CanvasRenderingContext2D | null = null;
/** Use the same measured text size in the inline editor and the baked surface texture. */
export function layerTextSize(layer: CoverLayer, width: number, height: number) {
  measure ||= document.createElement('canvas').getContext('2d');
  const size = height * 0.72;
  if (!measure) return size;
  measure.font = `${size}px ${layer.font}`;
  return size * Math.min(1, width / Math.max(1, measure.measureText(layer.text || '').width));
}
