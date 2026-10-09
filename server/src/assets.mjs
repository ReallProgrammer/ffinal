import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { fileTypeFromBuffer } from 'file-type';
import yauzl from 'yauzl';
export async function validateAsset(buffer, kind) {
  const detected = await fileTypeFromBuffer(buffer);
  if (kind !== 'digital') {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(detected?.mime))
      throw new Error('Covers must be genuine PNG, JPEG, or WebP images.');
    if (buffer.length > 10 * 1024 * 1024) throw new Error('Cover images must be 10 MB or smaller.');
    const image = sharp(buffer, { limitInputPixels: 40_000_000, failOn: 'warning' });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || (meta.pages || 1) > 1)
      throw new Error('Use a single, non-animated cover image.');
    const texture = await image
      .rotate()
      .resize({ width: 1024, height: 1536, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return { mime: detected.mime, texture };
  }
  if (buffer.length > 50 * 1024 * 1024) throw new Error('Digital books must be 50 MB or smaller.');
  if (detected?.mime === 'application/pdf') {
    if (!buffer.subarray(-4096).toString('latin1').includes('%%EOF'))
      throw new Error('This PDF is incomplete.');
    try {
      const document = await PDFDocument.load(buffer, { ignoreEncryption: false });
      if (!document.getPageCount()) throw new Error();
    } catch {
      throw new Error('This PDF is invalid, encrypted, or has no pages.');
    }
    return { mime: 'application/pdf' };
  }
  if (detected?.mime === 'application/epub+zip' || detected?.mime === 'application/zip') {
    await new Promise((resolve, reject) =>
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
        if (error) return reject(new Error('Invalid EPUB archive.'));
        let count = 0,
          total = 0,
          validMime = false,
          container = false,
          ended = false;
        const fail = (message) => {
          if (ended) return;
          ended = true;
          zip.close();
          reject(new Error(message));
        };
        zip.on('error', () => fail('Invalid EPUB archive.'));
        zip.on('entry', (entry) => {
          if (
            ++count > 5000 ||
            (total += entry.uncompressedSize) > 150 * 1024 * 1024 ||
            entry.generalPurposeBitFlag & 1 ||
            entry.fileName.split('/').includes('..') ||
            entry.fileName.startsWith('/')
          )
            return fail('Unsafe or oversized EPUB archive.');
          if (entry.fileName === 'META-INF/container.xml') container = true;
          if (entry.fileName.endsWith('/')) {
            zip.readEntry();
            return;
          }
          if (entry.fileName === 'mimetype' && entry.uncompressedSize > 100)
            return fail('Invalid EPUB mimetype.');
          zip.openReadStream(entry, (err, stream) => {
            if (err) return fail('Invalid EPUB contents.');
            let bytes = 0,
              text = '';
            stream.on('data', (chunk) => {
              bytes += chunk.length;
              if (bytes > entry.uncompressedSize) {
                stream.destroy();
                fail('Invalid EPUB expanded size.');
                return;
              }
              if (entry.fileName === 'mimetype') text += chunk;
            });
            stream.on('error', () => fail('Invalid EPUB contents.'));
            stream.on('end', () => {
              if (ended) return;
              if (entry.fileName === 'mimetype') validMime = text.trim() === 'application/epub+zip';
              zip.readEntry();
            });
          });
        });
        zip.on('end', () => {
          if (ended) return;
          ended = true;
          validMime && container ? resolve() : reject(new Error('This ZIP is not an EPUB book.'));
        });
        zip.readEntry();
      }),
    );
    return { mime: 'application/epub+zip' };
  }
  throw new Error('Digital books must be genuine PDF or EPUB files.');
}
