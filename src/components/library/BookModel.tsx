import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LibraryBook, LibraryRepository } from '../../lib/library/types';
import { useResources } from './resources';
import ObjectGeometry from './ObjectGeometry';
import ObjectSkeleton from './ObjectSkeleton';
export default function BookModel({
  book,
  repository,
  position = [0, 0, 0],
  rotation = 0,
  selected = false,
  hovered = false,
  onSelect,
  onHover,
  reduced = false,
  inspection = false,
  caseOpen,
  onToggleCase,
  onReady,
  onError,
}: {
  book: LibraryBook;
  repository: LibraryRepository;
  position?: [number, number, number];
  rotation?: number;
  selected?: boolean;
  hovered?: boolean;
  onSelect?: () => void;
  onHover?: (value: boolean) => void;
  reduced?: boolean;
  inspection?: boolean;
  caseOpen?: boolean;
  onToggleCase?: () => void;
  onReady?: (ready: boolean) => void;
  onError?: (error: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const resource = useResources(book, repository, selected || inspection);
  const scale = book.presentation?.scale || 1;
  const placed = useRef(0);
  useEffect(() => {
    onReady?.(Boolean(resource.value));
    onError?.(
      resource.error ? 'This object could not be prepared. Return and refresh to retry.' : '',
    );
  }, [resource.value, resource.error, onReady, onError]);
  useFrame((state, delta) => {
    if (!group.current) return;
    placed.current = Math.min(1, placed.current + delta * 2.5);
    const target = new THREE.Vector3(
      ...((inspection ? [0, 0, 0] : selected ? [0, 2, 5] : position) as [number, number, number]),
    );
    if (!inspection && !selected) target.y += reduced ? 0 : (1 - placed.current) * 0.28;
    if (!inspection && hovered && !selected) target.z += 0.18;
    const angle = inspection ? rotation : selected ? -0.2 : rotation;
    const rate = reduced ? 1 : 1 - Math.exp(-delta * 7);
    if (
      group.current.position.distanceTo(target) > 0.001 ||
      Math.abs(group.current.rotation.y - angle) > 0.001
    ) {
      group.current.position.lerp(target, rate);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, angle, rate);
      state.invalidate();
    }
  });
  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (resource.value) onSelect?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover?.(true);
      }}
      onPointerOut={() => onHover?.(false)}
    >
      {resource.value ? (
        <group scale={scale}>
          <ObjectGeometry
            item={book}
            resources={resource.value}
            open={caseOpen}
            onToggle={onToggleCase}
            reduced={reduced}
          />
        </group>
      ) : (
        <ObjectSkeleton item={book} error={Boolean(resource.error)} reduced={reduced} />
      )}
    </group>
  );
}
