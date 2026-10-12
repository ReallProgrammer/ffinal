import type { LibraryBook } from './types';

export function objectViewBounds(item: LibraryBook, aspect: number, fov: number, open = false) {
  const scale = item.presentation?.scale || 1;
  const angle = ((item.presentation?.openAngle || 125) * Math.PI) / 180;
  const width = item.width * scale * (open ? Math.max(1, 1 - 2 * Math.cos(angle)) : 1);
  const height = item.height * scale;
  const depth =
    (item.thickness + (open ? item.width * 2 * Math.sin(Math.min(angle, Math.PI / 2)) : 0)) * scale;
  const radius = Math.hypot(width, height, depth) / 2;
  const clearance = Math.max(0.12, radius * 0.12);
  const minDistance = radius + clearance;
  const halfFov = (fov * Math.PI) / 360;
  const fitDistance = Math.max(
    minDistance * 1.2,
    (Math.max(height, width / Math.max(0.1, aspect)) / (2 * Math.tan(halfFov))) * 1.22 + depth / 2,
  );
  return { radius, minDistance, fitDistance, maxDistance: fitDistance * 1.45 };
}
