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
