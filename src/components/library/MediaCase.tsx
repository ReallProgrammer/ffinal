import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LibraryBook } from '../../lib/library/types';
import { casePreset } from '../../lib/library/presets';
import type { Resources } from './resources';
type V = [number, number, number];
function Panel({
  size,
  position = [0, 0, 0],
  front,
  back,
  color = '#e7e4da',
  plastic = false,
  opacity = 0.9,
  roughness = 0.25,
}: {
  size: V;
  position?: V;
  front?: THREE.Texture;
  back?: THREE.Texture;
  color?: string;
  plastic?: boolean;
  opacity?: number;
  roughness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      {[null, null, null, null, front, back].map((map, i) => (
        <meshPhysicalMaterial
          key={i}
          attach={`material-${i}`}
          map={map || null}
          color={map ? '#ffffff' : color}
          roughness={map ? 0.64 : roughness}
          metalness={0}
          transmission={plastic && !map ? (1 - opacity) * 0.65 : 0}
          thickness={0.03}
          transparent={plastic && !map}
          opacity={plastic && !map ? Math.max(0.45, opacity) : 1}
          clearcoat={plastic ? 0.65 : 0}
          clearcoatRoughness={0.25}
        />
      ))}
    </mesh>
  );
}
export function Disc({ radius, label }: { radius: number; label?: THREE.Texture }) {
  const geometry = useMemo(() => {
    const g = new THREE.RingGeometry(radius * 0.12, radius, 96);
    const p = g.getAttribute('position'),
      uv = g.getAttribute('uv');
    for (let n = 0; n < p.count; n++)
      uv.setXY(n, p.getX(n) / (radius * 2) + 0.5, p.getY(n) / (radius * 2) + 0.5);
    return g;
  }, [radius]);
  return (
    <group>
      <mesh geometry={geometry} position={[0, 0, 0.018]}>
        <meshPhysicalMaterial
          map={label || null}
          color={label ? '#ffffff' : '#c6ccce'}
          metalness={label ? 0.08 : 0.72}
          roughness={label ? 0.58 : 0.22}
          iridescence={label ? 0 : 0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.035, 96, 1, true]} />
        <meshStandardMaterial color="#a7b2bd" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.12, radius * 0.12, 0.035, 40, 1, true]} />
        <meshStandardMaterial color="#b1bdc2" metalness={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.022]}>
        <ringGeometry args={[radius * 0.12, radius * 0.21, 64]} />
        <meshPhysicalMaterial color="#d2d8d6" metalness={0.5} roughness={0.2} transmission={0.2} />
      </mesh>
    </group>
  );
}
export default function MediaCase({
  item,
  resources,
  open = false,
  onToggle,
  reduced = false,
}: {
  item: LibraryBook;
  resources: Resources;
  open?: boolean;
  onToggle?: () => void;
  reduced?: boolean;
}) {
  const preset = casePreset(item),
    w = item.width,
    h = item.height,
    d = item.thickness,
    p = item.presentation;
  const color = p?.caseColor || preset.color,
    opacity = p?.plasticOpacity ?? preset.opacity,
    roughness = p?.plasticRoughness ?? preset.roughness;
  const plastic = { color, opacity, roughness, plastic: true },
    wall = Math.min(0.024, d * 0.15),
    cover = useRef<THREE.Group>(null);
  const bottom = preset.hinge === 'bottom',
    angle = ((p?.openAngle || 125) * Math.PI) / 180;
  useFrame((state, delta) => {
    if (!cover.current) return;
    const current = bottom ? cover.current.rotation.x : cover.current.rotation.y,
      target = open ? (bottom ? angle : -angle) : 0;
    if (Math.abs(current - target) > 0.0005) {
      const next = THREE.MathUtils.lerp(current, target, reduced ? 1 : 1 - Math.exp(-delta * 8));
      if (bottom) cover.current.rotation.x = next;
      else cover.current.rotation.y = next;
      state.invalidate();
    }
  });
  const iw = w - 0.09,
    ih = h - preset.band - 0.075,
    discRadius = Math.min(w * 0.43, h * 0.38),
    z = -d / 2 + wall * 2;
  const insert = (role: 'booklet' | 'card' | 'insert', pos: V, size: V) =>
    resources.maps[role] && item.artwork?.[role] ? (
      <Panel key={role} size={size} position={pos} back={resources.maps[role]} />
    ) : null;
  return (
    <group
      onClick={(event) => {
        if (onToggle && event.delta < 5) {
          event.stopPropagation();
          onToggle();
        }
      }}
    >
      <Panel size={[w, h, wall]} position={[0, 0, -d / 2]} {...plastic} />
      <Panel
        size={[iw, ih, 0.008]}
        position={[0, -preset.band / 2, -d / 2 - 0.012]}
        back={resources.maps.back}
        color={color}
      />
      <Panel
        size={[w - wall * 2, h - wall * 2, wall]}
        position={[0, 0, z]}
        color={preset.shape === 'jewel' ? '#3b4144' : color}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Panel size={[wall, h, d]} position={[(side * w) / 2, 0, 0]} {...plastic} />
          <Panel size={[w, wall, d]} position={[0, (side * h) / 2, 0]} {...plastic} />
        </group>
      ))}
      <mesh position={[-w / 2 - wall / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[d, h, 0.003]} />
        <meshStandardMaterial
          map={resources.maps.spine}
          color={resources.maps.spine ? 'white' : color}
          roughness={0.65}
        />
      </mesh>
      <group position={[0, 0, z + 0.04]}>
        {preset.shape === 'cassette' ? (
          p?.includeDisc ? (
            <>
              <Panel size={[w * 0.82, h * 0.65, d * 0.2]} color="#3c4545" />
              {[-1, 1].map((n) => (
                <mesh key={n} position={[n * w * 0.2, 0, d * 0.15]}>
                  <torusGeometry args={[h * 0.12, 0.025, 8, 32]} />
                  <meshStandardMaterial color="#bbc0b7" />
                </mesh>
              ))}
            </>
          ) : null
        ) : (
          <>
            <mesh>
              <ringGeometry args={[discRadius * 0.95, discRadius * 1.025, 80]} />
              <meshStandardMaterial color="#1e2427" />
            </mesh>
            {(p?.includeDisc || item.artwork?.disc) && (
              <Disc radius={discRadius} label={resources.maps.disc} />
            )}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.018]}>
              <cylinderGeometry args={[discRadius * 0.105, discRadius * 0.12, 0.09, 12]} />
              <meshStandardMaterial color={color} roughness={0.35} />
            </mesh>
            {Array.from({ length: 8 }, (_, n) => (
              <Panel
                key={n}
                size={[0.023, 0.055, 0.018]}
                position={[
                  Math.cos((n * Math.PI) / 4) * discRadius * 0.085,
                  Math.sin((n * Math.PI) / 4) * discRadius * 0.085,
                  0.07,
                ]}
                color={color}
              />
            ))}
          </>
        )}
      </group>
      {[-1, 1].map((n) => (
        <group key={n}>
          <mesh
            position={bottom ? [n * w * 0.35, -h / 2, 0] : [-w / 2, n * h * 0.36, 0]}
            rotation={bottom ? [0, 0, Math.PI / 2] : [0, 0, 0]}
          >
            <cylinderGeometry args={[d * 0.24, d * 0.24, Math.min(0.18, h * 0.1), 16]} />
            <meshPhysicalMaterial color={color} roughness={roughness} clearcoat={0.6} />
          </mesh>
          <Panel
            size={[0.05, 0.1, d * 0.45]}
            position={[w / 2 - wall, n * h * 0.26, d * 0.2]}
            {...plastic}
          />
          <Panel
            size={[0.07, 0.025, wall]}
            position={[w / 2 - 0.025, n * h * 0.26, d * 0.42]}
            {...plastic}
          />
        </group>
      ))}
      <group ref={cover} position={bottom ? [0, -h / 2, d / 2] : [-w / 2, 0, d / 2]}>
        <group position={bottom ? [0, h / 2, 0] : [w / 2, 0, 0]}>
          <Panel size={[w, h, wall]} {...plastic} />
          <Panel
            size={[iw, ih, 0.008]}
            position={[0, -preset.band / 2, 0.014]}
            front={resources.maps.front}
            back={resources.maps.interior}
            color="#e5e3d8"
          />
          {item.objectType === 'ps5' && (
            <Panel
              size={[iw, preset.band * 0.72, 0.009]}
              position={[0, h / 2 - preset.band * 0.5, 0.015]}
              color="#f3f4f3"
            />
          )}
          {(item.artwork?.booklet || item.artwork?.manual) && (
            <Panel
              size={[iw * 0.76, (iw * 0.76 * item.height) / item.width, 0.035]}
              position={[0, 0, -0.04]}
              back={resources.maps.booklet}
              color="#f4efdf"
            />
          )}
          {insert('card', [w * 0.12, -h * 0.24, -0.065], [iw * 0.58, (iw * 0.58) / 1.6, 0.008])}
          {insert(
            'insert',
            [-w * 0.13, h * 0.2, -0.075],
            [iw * 0.52, (iw * 0.52 * item.height) / item.width, 0.008],
          )}
          {[-1, 1].map((n) => (
            <Panel
              key={n}
              size={[0.08, 0.16, 0.045]}
              position={[n * w * 0.41, h * 0.16, -0.035]}
              {...plastic}
            />
          ))}
        </group>
      </group>
    </group>
  );
}
