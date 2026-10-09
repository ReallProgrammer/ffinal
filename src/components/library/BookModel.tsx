import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LibraryBook, LibraryRepository } from '../../lib/library/types';
function generatedTexture(book: LibraryBook, face: 'front' | 'spine' | 'back', detailed: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = face === 'spine' ? 256 : 768;
  canvas.height = 1024;
  const c = canvas.getContext('2d')!;
  c.fillStyle = book.color;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = '#ffffff12';
  for (let y = 0; y < 1024; y += 4) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(canvas.width, y);
    c.stroke();
  }
  c.strokeStyle = '#d5bd7b';
  c.lineWidth = 2;
  c.strokeRect(22, 30, canvas.width - 44, 964);
  c.fillStyle = '#efe4c3';
  c.textAlign = 'center';
  if (face === 'spine') {
    c.save();
    c.translate(128, 500);
    c.rotate(Math.PI / 2);
    c.font = '600 48px Georgia';
    c.fillText(book.title, 0, 0, 740);
    c.font = '26px Georgia';
    c.fillText(book.author, 0, 55, 690);
    c.restore();
    c.font = '21px Georgia';
    c.fillText(book.year ? String(book.year) : 'LIBRARY', 128, 940, 200);
  } else {
    c.font = '24px Georgia';
    c.fillText(face === 'front' ? 'PERSONAL LIBRARY' : 'GENERATED BACK DESIGN', 384, 125, 650);
    c.font = '46px Georgia';
    const words = (face === 'front' ? book.title : book.description || book.title).split(/\s+/);
    let line = '',
      y = 350;
    for (const word of words) {
      const next = line + ' ' + word;
      if (c.measureText(next).width > 610) {
        c.fillText(line, 384, y, 610);
        y += 62;
        line = word;
        if (y > 740) break;
      } else line = next;
    }
    c.fillText(line, 384, y, 610);
    c.font = '28px Georgia';
    c.fillText(book.author, 384, 875, 620);
  }
  let source = canvas;
  if (!detailed) {
    source = document.createElement('canvas');
    source.width = canvas.width / 2;
    source.height = 512;
    source.getContext('2d')!.drawImage(canvas, 0, 0, source.width, source.height);
  }
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function useArtwork(
  book: LibraryBook,
  face: 'front' | 'spine' | 'back',
  repository: LibraryRepository,
  detailed: boolean,
) {
  const generated = useMemo(
    () => generatedTexture(book, face, detailed),
    [book.title, book.author, book.description, book.color, book.year, face, detailed],
  );
  const [uploaded, setUploaded] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);
  const id = book[face]?.id;
  useEffect(() => () => generated.dispose(), [generated]);
  useEffect(() => {
    setUploaded(null);
    setFailed(false);
    if (!id) return;
    const abort = new AbortController();
    let disposed = false,
      texture: THREE.Texture | undefined,
      url = '';
    repository
      .texture(id, abort.signal)
      .then(
        (blob) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            if (disposed) {
              reject(new Error('Aborted'));
              return;
            }
            url = URL.createObjectURL(blob);
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = url;
          }),
      )
      .then((image) => {
        if (disposed) return;
        const canvas = document.createElement('canvas');
        canvas.height = detailed ? 1024 : 512;
        canvas.width = Math.max(
          48,
          Math.round(
            (canvas.height * (face === 'spine' ? book.thickness : book.width)) / book.height,
          ),
        );
        const c = canvas.getContext('2d')!;
        c.fillStyle = book.color;
        c.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
        c.drawImage(
          image,
          (canvas.width - image.width * scale) / 2,
          (canvas.height - image.height * scale) / 2,
          image.width * scale,
          image.height * scale,
        );
        texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        setUploaded(texture);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      abort.abort();
      texture?.dispose();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, repository, book.width, book.height, book.thickness, book.color, face, detailed]);
  return { map: uploaded || generated, loaded: !id || Boolean(uploaded), failed };
}
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
  onReady?: (ready: boolean) => void;
  onError?: (error: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const front = useArtwork(book, 'front', repository, selected || inspection),
    spine = useArtwork(book, 'spine', repository, selected || inspection),
    back = useArtwork(book, 'back', repository, selected || inspection);
  const { width: w, height: h, thickness: t } = book;
  useEffect(
    () =>
      onReady?.(
        front.loaded &&
          spine.loaded &&
          back.loaded &&
          !front.failed &&
          !spine.failed &&
          !back.failed,
      ),
    [front.loaded, spine.loaded, back.loaded, front.failed, spine.failed, back.failed, onReady],
  );
  useEffect(() => {
    onError?.(
      front.failed || spine.failed || back.failed
        ? 'Artwork could not be loaded. A generated binding is shown; refresh the library to retry.'
        : '',
    );
  }, [front.failed, spine.failed, back.failed, onError]);
  useFrame((state, delta) => {
    if (!group.current) return;
    const target = inspection
      ? new THREE.Vector3(0, 0, 0)
      : selected
        ? new THREE.Vector3(0, position[1], 3.4)
        : new THREE.Vector3(position[0], position[1], position[2] + (hovered ? 0.2 : 0));
    const rate = reduced ? 1 : 1 - Math.exp(-delta * 9);
    const angle = inspection ? rotation : selected ? -0.18 : rotation;
    if (
      group.current.position.distanceTo(target) > 0.001 ||
      Math.abs(group.current.rotation.y - angle) > 0.001
    ) {
      group.current.position.lerp(target, rate);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, angle, rate);
      state.invalidate();
    }
  });
  const plane = (map: THREE.Texture, width: number, height: number) => (
    <>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={map} roughness={0.78} metalness={0.03} />
    </>
  );
  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover?.(true);
      }}
      onPointerOut={() => onHover?.(false)}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w - 0.06, h - 0.12, Math.max(0.06, t - 0.08)]} />
        <meshStandardMaterial color="#e4dcc6" roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0, (side * t) / 2]} castShadow>
          <boxGeometry args={[w, h, 0.045]} />
          <meshStandardMaterial color={book.color} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0, t / 2 + 0.024]}>{plane(front.map, w, h)}</mesh>
      <mesh position={[0, 0, -t / 2 - 0.024]} rotation={[0, Math.PI, 0]}>
        {plane(back.map, w, h)}
      </mesh>
      <mesh position={[-w / 2, 0, 0]} castShadow>
        <boxGeometry args={[0.065, h, t]} />
        <meshStandardMaterial color={book.color} roughness={0.8} />
      </mesh>
      <mesh position={[-w / 2 - 0.034, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        {plane(spine.map, t, h)}
      </mesh>
      {[...Array(8)].map((_, i) => (
        <mesh
          key={i}
          position={[w / 2 - 0.026, 0, -t / 2 + 0.05 + i * Math.max(0.01, (t - 0.1) / 8)]}
        >
          <boxGeometry args={[0.008, h - 0.14, 0.003]} />
          <meshStandardMaterial color="#baaf98" />
        </mesh>
      ))}
    </group>
  );
}
