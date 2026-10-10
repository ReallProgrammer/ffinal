import { createContext, useContext, useMemo } from 'react';
const Roughness = createContext(0.65);
import * as THREE from 'three';
import type { LibraryBook } from '../../lib/library/types';
import { objectType } from '../../lib/library/registry';
import type { Resources } from './resources';
type V = [number, number, number];
function Box({
  size,
  position = [0, 0, 0],
  color = '#333',
  front,
  back,
  spine,
  roughness,
}: {
  size: V;
  position?: V;
  color?: string;
  front?: THREE.Texture;
  back?: THREE.Texture;
  spine?: THREE.Texture;
  roughness?: number;
}) {
  const defaultRoughness = useContext(Roughness);
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      {[undefined, spine, undefined, undefined, front, back].map((map, i) => (
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          map={map}
          color={map ? '#ffffff' : color}
          roughness={roughness ?? defaultRoughness}
        />
      ))}
    </mesh>
  );
}
function Ring({ position, radius = 0.22 }: { position: V; radius?: number }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.035, 28]} />
        <meshStandardMaterial color="#161a1d" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh>
        <torusGeometry args={[radius * 0.6, radius * 0.12, 8, 24]} />
        <meshStandardMaterial color="#b9b7ac" metalness={0.5} />
      </mesh>
    </group>
  );
}
interface Props {
  item: LibraryBook;
  resources: Resources;
}
function Book({ item: i, resources: r }: Props) {
  const { width: w, height: h, thickness: d } = i;
  return (
    <>
      <Box size={[w - 0.06, h - 0.09, d * 0.85]} color="#e9e0cf" />
      <Box size={[w, h, 0.035]} position={[0, 0, d / 2]} color={i.color} front={r.maps.front} />
      <Box size={[w, h, 0.035]} position={[0, 0, -d / 2]} color={i.color} back={r.maps.back} />
      <Box
        size={[0.05, h, d + 0.035]}
        position={[-w / 2 + 0.025, 0, 0]}
        color={i.color}
        spine={r.maps.spine}
      />
      {Array.from({ length: 12 }, (_, n) => (
        <Box
          key={n}
          size={[0.006, h - 0.1, 0.003]}
          position={[w / 2 - 0.027, 0, -d * 0.4 + (n * d * 0.8) / 12]}
          color="#bdb3a1"
        />
      ))}
    </>
  );
}
function Certificate({ item: i, resources: r }: Props) {
  const { width: w, height: h, thickness: d } = i;
  const f = i.presentation?.frame !== false ? 0.075 : 0;
  return (
    <>
      <Box size={[w, h, d]} color="#ded4be" front={r.maps.front} back={r.maps.back} />
      {f > 0 && (
        <>
          {[-1, 1].map((s) => (
            <group key={s}>
              <Box
                size={[w + 0.02, f, d + 0.03]}
                position={[0, (s * (h - f)) / 2, 0]}
                color={i.color}
                roughness={0.32}
              />
              <Box
                size={[f, h, d + 0.03]}
                position={[(s * (w - f)) / 2, 0, 0]}
                color={i.color}
                roughness={0.32}
              />
            </group>
          ))}
        </>
      )}
    </>
  );
}
function Case({ item: i, resources: r }: Props) {
  const { width: w, height: h, thickness: d } = i;
  const c =
    (
      {
        ps5: '#164d9e',
        xbox: '#186b39',
        bluray: '#126ba4',
        dvd: '#16181a',
        pc: '#29252d',
        vhs: '#242224',
      } as Record<string, string>
    )[i.objectType || ''] || i.color;
  const top = ['ps5', 'xbox', 'bluray'].includes(i.objectType || '') ? 0.13 : 0.025;
  return (
    <>
      <Box size={[w, h, d]} color={c} spine={r.maps.spine} roughness={0.3} />
      <Box
        size={[w - 0.06, h - top - 0.05, 0.006]}
        position={[0, -top / 2, d / 2 + 0.003]}
        color={c}
        front={r.maps.front}
        roughness={i.presentation?.roughness}
      />
      <Box
        size={[w - 0.06, h - top - 0.05, 0.006]}
        position={[0, -top / 2, -d / 2 - 0.003]}
        color={c}
        back={r.maps.back}
      />
      <Box
        size={[w - 0.08, top * 0.6, 0.01]}
        position={[0, h / 2 - top / 2, d / 2]}
        color={i.objectType === 'ps5' ? '#e5e8ed' : c}
      />
      <Box size={[0.022, h - 0.06, 0.035]} position={[w / 2 - 0.025, 0, d / 2]} color={c} />
    </>
  );
}
function Cassette({ item: i, resources: r }: Props) {
  const { width: w, height: h, thickness: d } = i;
  return (
    <>
      <Box
        size={[w, h, d]}
        color={i.color}
        front={r.maps.front}
        back={r.maps.back}
        roughness={0.42}
      />
      <Box
        size={[w * 0.77, h * 0.38, 0.018]}
        position={[0, h * 0.09, d / 2 + 0.01]}
        color="#74746a"
      />
      {[-1, 1].map((s) => (
        <Ring
          key={s}
          radius={Math.min(h * 0.14, w * 0.1)}
          position={[s * w * 0.23, h * 0.09, d / 2 + 0.04]}
        />
      ))}
      <Box size={[w * 0.62, h * 0.19, d * 0.8]} position={[0, -h * 0.39, 0.035]} color="#343735" />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * w * 0.38, -h * 0.32, d / 2 + 0.01]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#c2c2b8" metalness={0.8} />
        </mesh>
      ))}
    </>
  );
}
function Tape({ item: i, resources: r }: Props) {
  const { width: w, height: h, thickness: d } = i;
  return (
    <>
      <Box size={[w, h, d]} color="#191c20" back={r.maps.back} spine={r.maps.spine} />
      <Box size={[w * 0.98, h * 0.12, d * 1.04]} position={[0, h * 0.43, 0]} color="#2c3034" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            size={[w * 0.27, h * 0.6, 0.015]}
            position={[side * w * 0.31, -h * 0.02, d / 2 + 0.012]}
            color="#343c40"
          />
          <Ring
            position={[side * w * 0.31, -h * 0.02, d / 2 + 0.034]}
            radius={Math.min(h * 0.21, w * 0.125)}
          />
          <Box
            size={[0.025, h * 0.65, 0.02]}
            position={[side * w * 0.47, 0, d / 2 + 0.014]}
            color="#555c5b"
          />
        </group>
      ))}
      <Box
        size={[w * 0.3, h * 0.36, 0.012]}
        position={[0, 0, d / 2 + 0.015]}
        color="#ccc9b5"
        front={r.maps.front}
      />
    </>
  );
}
function MiniDisc({ item: i, resources: r }: Props) {
  const { width: w, height: h, thickness: d } = i;
  return (
    <>
      <Box size={[w, h, d]} color={i.color} front={r.maps.front} back={r.maps.back} />
      <Box
        size={[w * 0.42, h, 0.035]}
        position={[w * 0.2, 0, d / 2 + 0.015]}
        color="#adb3b7"
        roughness={0.25}
      />
      <Box
        size={[w * 0.14, h * 0.45, 0.038]}
        position={[w * 0.2, 0, d / 2 + 0.018]}
        color="#252a2c"
      />
      <Ring position={[-w * 0.23, -h * 0.18, d / 2 + 0.025]} radius={Math.min(w, h) * 0.17} />
    </>
  );
}
function Vinyl({ item: i, resources: r }: Props) {
  const { width: w, height: h, thickness: d } = i;
  return (
    <>
      <Box
        size={[w, h, d]}
        color={i.color}
        front={r.maps.front}
        back={r.maps.back}
        spine={r.maps.spine}
      />
      <mesh position={[w * 0.14, 0, -d * 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[Math.min(w, h) * 0.48, Math.min(w, h) * 0.48, d * 0.35, 64]} />
        <meshStandardMaterial color="#151719" roughness={0.25} />
      </mesh>
    </>
  );
}
function Model({ item, resources }: Props) {
  const object = useMemo(() => {
    if (!resources.model) return null;
    const group = new THREE.Group();
    const clone = resources.model.clone(true);
    clone.rotation.set(
      ...((item.presentation?.rotation || [0, 0, 0]).map((n) => THREE.MathUtils.degToRad(n)) as V),
    );
    group.add(clone);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group),
      size = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    const scale = Math.min(
      item.width / Math.max(size.x, 0.001),
      item.height / Math.max(size.y, 0.001),
      item.thickness / Math.max(size.z, 0.001),
    );
    group.scale.setScalar(scale);
    return group;
  }, [
    resources.model,
    item.width,
    item.height,
    item.thickness,
    JSON.stringify(item.presentation?.rotation),
  ]);
  return object ? <primitive object={object} dispose={null} /> : null;
}
const geometries: Record<string, React.ComponentType<Props>> = {
  book: Book,
  certificate: Certificate,
  case: Case,
  vhs: Case,
  cassette: Cassette,
  tape: Tape,
  minidisc: MiniDisc,
  vinyl: Vinyl,
  model: Model,
};
export default function ObjectGeometry(props: Props) {
  const Geometry = geometries[objectType(props.item).geometry];
  return (
    <Roughness.Provider value={props.item.presentation?.roughness ?? 0.65}>
      <Geometry {...props} />
    </Roughness.Provider>
  );
}
