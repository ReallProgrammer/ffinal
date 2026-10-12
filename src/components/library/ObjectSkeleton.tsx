import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  const { invalidate, gl } = useThree();
  const base = useMemo(() => new THREE.Color('#9eaaa5'), []);
  const highlight = useMemo(() => new THREE.Color('#e0e7df'), []);
  useEffect(() => {
    invalidate();
    return () => {
      delete gl.domElement.parentElement?.dataset.loadingPhase;
    };
  }, [invalidate, gl]);
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
    const phase = (Math.sin(state.clock.elapsedTime * 2.8) + 1) / 2;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.055;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.075;
    group.current.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.copy(base).lerp(highlight, phase * 0.65);
          material.emissive.copy(highlight);
          material.emissiveIntensity = phase * 0.12;
        }
      }
    });
    const node = gl.domElement.parentElement;
    if (node) node.dataset.loadingPhase = phase.toFixed(3);
    state.invalidate();
  });
  return (
    <group ref={group} name="typed-loading-placeholder" scale={item.presentation?.scale || 1}>
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
