/**
 * Passes only if the harness marker below the crop line turned magenta, which
 * the popup triggers at the end of its boot. Without it a screenshot can catch
 * a half-rendered popup or the wrong tab.
 */
const fs = require('fs'), zlib = require('zlib');
function decode(file) {
  const buf = fs.readFileSync(file);
  let p = 8, idat = [], w, h, ct;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp + 1, out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * stride], line = raw.subarray(y * stride + 1, y * stride + 1 + w * bpp);
    for (let x = 0; x < w * bpp; x++) {
      const a = x >= bpp ? out[y * w * bpp + x - bpp] : 0, b = y > 0 ? out[(y - 1) * w * bpp + x] : 0,
            c = (x >= bpp && y > 0) ? out[(y - 1) * w * bpp + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += Math.floor((a + b) / 2);
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[y * w * bpp + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
const img = decode(process.argv[2]);
const i = (812 * img.w + 10) * img.bpp;
const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
if (!(r > 200 && g < 60 && b > 200)) {
  console.error(`popup not ready in ${process.argv[2]} (marker rgb(${r},${g},${b}))`);
  process.exit(1);
}
