import { zipSync, strToU8 } from 'fflate';
import sharp from 'sharp';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = process.argv[2] || '/tmp/library-fixtures';
await mkdir(directory, { recursive: true });
for (const [name, color] of [
  ['cover', '#254d43'],
  ['revised', '#743e31'],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="${color}"/><rect x="30" y="30" width="540" height="840" fill="none" stroke="#d9c995" stroke-width="3"/><text x="300" y="200" fill="#eee3c5" text-anchor="middle" font-family="serif" font-size="30">LIBRARY WORKFLOW TEST</text><text x="300" y="400" fill="#eee3c5" text-anchor="middle" font-family="serif" font-size="55">The Test Edition</text><text x="300" y="490" fill="#eee3c5" text-anchor="middle" font-family="serif" font-size="28">Actual uploaded artwork</text><text x="300" y="770" fill="#eee3c5" text-anchor="middle" font-family="serif" font-size="20">${name === 'cover' ? 'FIRST COVER' : 'REVISED COVER'}</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${directory}/${name}.png`);
}
const pdf = await PDFDocument.create();
const page = pdf.addPage([500, 700]);
const font = await pdf.embedFont(StandardFonts.TimesRoman);
page.drawText('A real digital edition', { x: 50, y: 610, size: 28, font });
page.drawText('Uploaded through the private library interface.', { x: 50, y: 565, size: 14, font });
await writeFile(`${directory}/edition.pdf`, await pdf.save());
console.log('Created isolated integration fixtures.');

await writeFile(
  `${directory}/edition.epub`,
  zipSync({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(
      '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    'OEBPS/book.opf': strToU8(
      '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>',
    ),
    'OEBPS/one.xhtml': strToU8(
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title></head><body><h1>First chapter</h1><p>A real reflowable reading edition.</p><script>window.epubScriptRan=true</script></body></html>',
    ),
    'OEBPS/two.xhtml': strToU8(
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Second chapter</h1><p>The next page of the story.</p></body></html>',
    ),
  }),
);
const spread = await PDFDocument.create();
for (let n = 1; n <= 4; n++) {
  const p = spread.addPage([500, 700]);
  p.drawText(`Actual document page ${n}`, { x: 50, y: 600, size: 28 });
  p.drawText('Collection room PDF rendering verification', { x: 50, y: 550, size: 14 });
}
await writeFile(`${directory}/four-pages.pdf`, await spread.save());
const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const uv = new Float32Array([0, 0, 1, 0, 0, 1]);
const geometry = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(uv.buffer)]);
const modelTexture = await sharp({
  create: { width: 2048, height: 2048, channels: 3, background: '#26705b' },
})
  .png()
  .toBuffer();
const gltf = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
  images: [{ uri: 'data:image/png;base64,' + modelTexture.toString('base64') }],
  textures: [{ source: 0 }],
  materials: [
    {
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.7,
      },
    },
  ],
  buffers: [
    {
      uri: 'data:application/octet-stream;base64,' + geometry.toString('base64'),
      byteLength: geometry.length,
    },
  ],
  bufferViews: [
    { buffer: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 24 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' },
  ],
};
await writeFile(`${directory}/triangle.gltf`, JSON.stringify(gltf));
