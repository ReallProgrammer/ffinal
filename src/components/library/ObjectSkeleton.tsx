import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LibraryBook } from '../../lib/library/types';
import ObjectGeometry from './ObjectGeometry';
import type { Resources } from './resources';
export default function ObjectSkeleton({
  item,
  error,
  reduced,
}: {
  item: LibraryBook;
  error: boolean;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const placeholder = useMemo(
    () => ({
      ...item,
      color: error ? '#884841' : '#afb9b5',
      front: null,
      back: null,
      spine: null,
      artwork: {},
      layers: {},
      presentation: {
        ...item.presentation!,
        textOverlay: false,
        caseColor: error ? '#884841' : '#afb9b5',
        frameColor: '#afb9b5',
      },
    }),
    [item, error],
  );
  useFrame((state) => {
    if (!group.current || reduced || error) return;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.025;
    state.invalidate();
  });
  return (
    <group ref={group} name="typed-loading-placeholder">
      {item.objectType === 'model' ? (
        <mesh>
          <icosahedronGeometry args={[Math.min(item.width, item.height) * 0.4, 1]} />
          <meshStandardMaterial wireframe color={placeholder.color} />
        </mesh>
      ) : (
        <ObjectGeometry item={placeholder} resources={{ maps: {} } as Resources} reduced />
      )}
    </group>
  );
}
