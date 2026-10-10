import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as Orbit } from 'three-stdlib';
import BookModel from './BookModel';
import { objectType, footprint } from '../../lib/library/registry';
import type { LibraryBook, LibraryRepository, LibraryShelf } from '../../lib/library/types';
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#8d623d';
  c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    c.strokeStyle = `rgba(${i % 3 ? '49,25,12' : '215,164,104'},${0.05 + (i % 7) * 0.012})`;
    c.lineWidth = i % 4 ? 1 : 3;
    c.beginPath();
    for (let x = 0; x <= 512; x += 8) {
      const y = i * 3.3 + Math.sin(x * 0.017 + i * 0.7) * 3 + Math.sin(x * 0.039) * 1.5;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function Rig({
  selected,
  target,
  zoom,
  reduced,
  orbitRef,
  extent = 3,
}: {
  extent?: number;
  selected: boolean;
  target: THREE.Vector3;
  zoom: number;
  reduced: boolean;
  orbitRef: React.RefObject<Orbit | null>;
}) {
  const { camera, invalidate, size } = useThree();
  const animate = useRef(true);
  const elapsed = useRef(0);
  const destination = useMemo(
    () =>
      new THREE.Vector3(
        selected ? 1.5 : 1,
        target.y + (selected ? 0.2 : 0.8),
        selected
          ? target.z + Math.max(6, extent * 1.7, ((extent * size.height) / size.width) * 1.5)
          : Math.max(14, target.y * 3.4, (14 * size.height) / size.width),
      ),
    [selected, target, size.width, size.height, extent],
  );
  useEffect(() => {
    animate.current = true;
    elapsed.current = 0;
    invalidate();
  }, [destination, zoom, invalidate]);
  useEffect(() => {
    const controls = orbitRef.current;
    const stop = () => {
      animate.current = false;
    };
    controls?.addEventListener('start', stop);
    return () => controls?.removeEventListener('start', stop);
  }, [orbitRef]);
  useFrame((_, delta) => {
    if (!animate.current || !orbitRef.current) return;
    elapsed.current += delta;
    const speed = reduced ? 1 : 1 - Math.exp(-delta * 5);
    camera.position.lerp(destination.clone().sub(target).multiplyScalar(zoom).add(target), speed);
    orbitRef.current.target.lerp(target, speed);
    orbitRef.current.update();
    invalidate();
    if (reduced || elapsed.current > 1.6) animate.current = false;
  });
  return null;
}
function Room({
  books,
  shelves,
  selected,
  onSelect,
  repository,
  reduced,
  zoom,
  onHover,
  onArtworkReady,
  onArtworkError,
  autoRotate,
  resetKey,
  caseOpen,
  onToggleCase,
}: SceneProps) {
  const texture = useMemo(woodTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const orbit = useRef<Orbit>(null);
  const [hovered, setHovered] = useState('');
  const [isolated, setIsolated] = useState(false);
  useEffect(() => {
    if (!selected) {
      setIsolated(false);
      return;
    }
    const timer = setTimeout(() => setIsolated(true), reduced ? 0 : 350);
    return () => clearTimeout(timer);
  }, [selected, reduced]);
  // Each overflow row is another physical shelf, never overlapping book geometry.
  const rows = useMemo(() => {
    const result: { shelf: LibraryShelf; books: LibraryBook[] }[] = [];
    for (const shelf of shelves.length
      ? shelves
      : [{ id: 'empty', name: 'The library', position: 0, appearance: {} }]) {
      const items = books.filter((b) => b.shelfId === shelf.id);
      let row: LibraryBook[] = [],
        used = 0;
      for (const b of items) {
        if (
          used + footprint(b).width + (shelf.appearance?.spacing || 0.5) >
            (shelf.appearance?.width || 11.8) - 1.4 &&
          row.length
        ) {
          result.push({ shelf, books: row });
          row = [];
          used = 0;
        }
        row.push(b);
        used += footprint(b).width + (shelf.appearance?.spacing || 0.5);
      }
      result.push({ shelf, books: row });
    }
    return result;
  }, [books, shelves]);
  const count = Math.max(2, rows.length);
  const rowHeights = Array.from({ length: count }, (_, i) =>
    Math.max(3.6, ...(rows[i]?.books || []).map((b) => footprint(b).height + 0.5)),
  );
  const height = rowHeights.reduce((a, b) => a + b, 0);
  const bottoms = rowHeights.map((_, i) => rowHeights.slice(i + 1).reduce((a, b) => a + b, 0));
  const width = Math.max(6, ...shelves.map((s) => s.appearance?.width || 11.8));
  const depth = Math.max(
    2.6,
    ...shelves.map((s) => s.appearance?.depth || 2.6),
    ...books.map((b) => footprint(b).depth + 0.4),
  );

  const inspected = books.find((b) => b.id === selected);
  const target = useMemo(
    () => new THREE.Vector3(0, inspected ? 2 : height / 2, inspected ? 5 : 0),
    [inspected, height, count, resetKey],
  );
  function timber(
    key: string,
    pos: [number, number, number],
    dimensions: [number, number, number],
    tint = '#bfa483',
  ) {
    return (
      <mesh key={key} position={pos} receiveShadow castShadow>
        <boxGeometry args={dimensions} />
        <meshStandardMaterial map={texture} roughness={0.72} color={tint} />
      </mesh>
    );
  }
  return (
    <>
      <color attach="background" args={[isolated ? '#e4e6e0' : '#e7dfcc']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#62645f', 0.8]} />
      <directionalLight
        position={[-5, 13, 9]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={15}
        shadow-camera-bottom={-4}
        shadow-bias={-0.001}
      />
      <pointLight position={[7, 7, 6]} intensity={12} color="#fff0c6" />
      <mesh
        position={[
          0,
          isolated
            ? 2 - ((inspected?.height || 3) * (inspected?.presentation?.scale || 1)) / 2 - 0.08
            : -0.32,
          0,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#c8beaa" roughness={1} />
      </mesh>
      <group visible={!isolated} name="collection-shelves">
        {timber('back', [0, height / 2, -depth / 2], [width - 0.1, height + 0.3, 0.16])}
        {[-width / 2 + 0.05, width / 2 - 0.05].map((x) =>
          timber(String(x), [x, height / 2, 0], [0.22, height + 0.5, depth]),
        )}
        {Array.from({ length: count + 1 }, (_, i) =>
          timber(
            'row' + i,
            [0, i === count ? height : bottoms[i], 0],
            [width, 0.22, depth],
            rows[i]?.shelf.appearance?.color,
          ),
        )}
      </group>
      {rows.map((row, i) => {
        let x = -(row.shelf.appearance?.width || 11.8) / 2 + 0.7;
        return row.books.map((book) => {
          const current = x + footprint(book).width / 2;
          x += footprint(book).width + (row.shelf.appearance?.spacing || 0.5);
          return (
            <group key={book.id} visible={!isolated || book.id === selected}>
              <BookModel
                book={book}
                repository={repository}
                position={[current, bottoms[i] + footprint(book).height / 2 + 0.14, 0.02]}
                rotation={footprint(book).rotation}
                selected={selected === book.id}
                caseOpen={selected === book.id && caseOpen}
                onToggleCase={selected === book.id ? onToggleCase : undefined}
                hovered={hovered === book.id}
                reduced={reduced}
                onSelect={() => onSelect(book.id)}
                onHover={(value) => {
                  setHovered(value ? book.id : '');
                  onHover?.(value ? book.title : '');
                }}
                onReady={selected === book.id ? onArtworkReady : undefined}
                onError={selected === book.id ? onArtworkError : undefined}
              />
            </group>
          );
        });
      })}
      <OrbitControls
        ref={orbit}
        makeDefault
        autoRotate={Boolean(selected && autoRotate && !reduced)}
        autoRotateSpeed={0.8}
        enablePan={!selected}
        zoomToCursor
        minDistance={selected ? 0.6 : 3}
        maxDistance={Math.max(34, height * 3)}
        minPolarAngle={0.55}
        maxPolarAngle={1.65}
        minAzimuthAngle={selected ? -Infinity : -0.6}
        maxAzimuthAngle={selected ? Infinity : 0.6}
        enableDamping={!reduced}
        dampingFactor={0.12}
      />
      <Rig
        extent={
          inspected
            ? Math.max(inspected.width, inspected.height) * (inspected.presentation?.scale || 1)
            : 3
        }
        selected={Boolean(selected)}
        target={target}
        zoom={zoom}
        reduced={reduced}
        orbitRef={orbit}
      />
    </>
  );
}
interface SceneProps {
  books: LibraryBook[];
  shelves: LibraryShelf[];
  selected: string;
  onSelect: (id: string) => void;
  repository: LibraryRepository;
  reduced: boolean;
  zoom: number;
  onHover?: (title: string) => void;
  onArtworkReady?: (ready: boolean) => void;
  onArtworkError?: (error: string) => void;
  autoRotate?: boolean;
  resetKey?: number;
  caseOpen?: boolean;
  onToggleCase?: () => void;
}
export default function LibraryScene(props: SceneProps) {
  const [available] = useState(() => {
    try {
      const c = document.createElement('canvas');
      const context = c.getContext('webgl2');
      if (!context) return false;
      context.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if ((!available || lost) && props.selected) {
      props.onArtworkReady?.(false);
      props.onArtworkError?.(
        '3D is unavailable on this device. Details and documents remain available.',
      );
    }
  }, [available, lost, props.selected, props.onArtworkReady, props.onArtworkError]);
  const fallback = (
    <div className="library-webgl-fallback">
      <span>READING ROOM</span>
      <h2>A quieter view.</h2>
      <p>
        3D rendering is unavailable on this device. Use the book index to inspect details and read
        available editions.
      </p>
    </div>
  );
  if (!available || lost) return fallback;
  return (
    <SceneBoundary fallback={fallback}>
      <div
        className="library-canvas"
        data-renderer="three-webgl"
        data-ready={ready}
        data-presentation={props.selected ? 'standalone' : 'shelves'}
        aria-label="Interactive 3D wooden bookshelf"
      >
        {!ready && <div className="library-loading">Opening the reading room…</div>}
        <Canvas
          shadows
          dpr={[1, 2]}
          frameloop="demand"
          camera={{ position: [1, 5, 18], fov: 42, near: 0.1, far: 100 }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1,
          }}
          onCreated={({ gl }) => {
            setReady(true);
            gl.domElement.addEventListener('webglcontextlost', () => setLost(true), { once: true });
          }}
        >
          <Suspense fallback={null}>
            <Room {...props} />
          </Suspense>
        </Canvas>
      </div>
    </SceneBoundary>
  );
}
export function BookPreview({
  book,
  repository,
  reduced,
  background = '#ded5c0',
  light = 3,
}: {
  background?: string;
  light?: number;
  book: LibraryBook;
  repository: LibraryRepository;
  reduced: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  return (
    <SceneBoundary fallback={<p>3D preview is unavailable on this device.</p>}>
      <div className="book-preview" data-textures-ready={ready}>
        <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: [2, 0.6, 5], fov: 40 }}>
          <color attach="background" args={[background]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[-4, 6, 5]} intensity={light} />
          <BookModel
            book={book}
            repository={repository}
            inspection
            caseOpen={open}
            onToggleCase={() => setOpen((v) => !v)}
            reduced={reduced}
            onReady={setReady}
            onError={setError}
          />
          <OrbitControls zoomToCursor enablePan minDistance={0.4} maxDistance={14} />
        </Canvas>
        {objectType(book).geometry === 'case' && (
          <button type="button" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close case' : 'Open case'}
          </button>
        )}
        <small>
          {error || (ready ? 'Drag to turn · scroll to zoom' : 'Preparing cover textures…')}
        </small>
      </div>
    </SceneBoundary>
  );
}
