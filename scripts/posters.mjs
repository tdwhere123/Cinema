// Read-only originals: full portrait for detail, centre-cover square for discs.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
for (const [id, title] of [
  ['possible-love', '可能的爱'],
  ['poetry', '诗'],
]) {
  const dir = `assets/${id}`;
  await mkdir(dir, { recursive: true });
  const input = `.do-it/${title}.png`;
  await sharp(input)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(`${dir}/poster.webp`);
  await sharp(input)
    .resize(768, 768, { fit: 'cover', position: 'centre' })
    .webp({ quality: 90 })
    .toFile(`${dir}/disc.webp`);
}
