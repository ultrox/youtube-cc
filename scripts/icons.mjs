// Render assets/icon.svg → public/icon/{16,32,48,128}.png.
// WXT picks up public/icon/<size>.png automatically for the manifest.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const SIZES = [16, 32, 48, 128];
const svg = readFileSync('assets/icon.svg');
mkdirSync('public/icon', { recursive: true });
for (const size of SIZES) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/icon/${size}.png`, png);
}
console.log(`public/icon: ${SIZES.join(', ')}px`);
