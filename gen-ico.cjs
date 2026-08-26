'use strict';

/**
 * Creates a proper 256x256 ICO file from scratch using pure binary operations.
 * The icon depicts the "alx" brand — a dark blue/gold shipping system icon.
 */

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
//  نُنشئ صورة PNG 256×256 نظيفة باستخدام الـ canvas API عبر node-canvas
//  إن لم يكن متاحاً، نستخدم طريقة بديلة بـ raw PNG binary
// ─────────────────────────────────────────────────────────────

const icoOut = path.resolve(__dirname, 'electron/assets/icon.ico');
const pngOut = path.resolve(__dirname, 'electron/assets/icon_clean.png');

// ─── نبني PNG نقي الصواب (256x256) بهيكل ثنائي صحيح ──────────
// سنستخدم الـ zlib المدمج لضغط بيانات الصورة

const { deflateSync } = require('zlib');

const WIDTH  = 256;
const HEIGHT = 256;

// ─── إنشاء بيانات RGBA ───────────────────────────────────────
// نرسم دائرة ذهبية على خلفية زرقاء داكنة مع حرف "A"

const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 4)); // filter byte + RGBA per pixel

for (let y = 0; y < HEIGHT; y++) {
  raw[y * (WIDTH * 4 + 1)] = 0; // filter type = None

  for (let x = 0; x < WIDTH; x++) {
    const off  = y * (WIDTH * 4 + 1) + 1 + x * 4;
    const cx   = x - WIDTH  / 2;
    const cy   = y - HEIGHT / 2;
    const dist = Math.sqrt(cx * cx + cy * cy);

    let r, g, b, a;

    if (dist > 120) {
      // خارج الدائرة — شفاف
      r = 0; g = 0; b = 0; a = 0;
    } else if (dist > 110) {
      // حافة ذهبية
      r = 212; g = 175; b = 55; a = 255;
    } else {
      // داخل الدائرة — خلفية داكنة أزرق-رمادي
      r = 15; g = 23; b = 42; a = 255;

      // رسم حرف "A" تقريبي (مبسّط)
      const tx = cx + WIDTH  / 2 - 90;
      const ty = cy + HEIGHT / 2 - 60;

      // الساقان
      const leftLeg  = (tx > 20 && tx < 45 && ty > 40 && ty < 140 && tx - 20 < (ty * 25 / 100));
      const rightLeg = (tx > 100 && tx < 125 && ty > 40 && ty < 140 && 125 - tx < (ty * 25 / 100));
      // القمة
      const topPeak  = (ty > 20 && ty < 50 && Math.abs(tx - 72) < (ty - 20) * 0.6);
      // الوسط
      const crossbar = (ty > 85 && ty < 100 && tx > 35 && tx < 110);

      if (leftLeg || rightLeg || topPeak || crossbar) {
        r = 212; g = 175; b = 55; // ذهبي
      }
    }

    raw[off + 0] = r;
    raw[off + 1] = g;
    raw[off + 2] = b;
    raw[off + 3] = a;
  }
}

// ─── PNG chunk builders ───────────────────────────────────────
function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len   = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const body  = Buffer.concat([typeBytes, data]);
  const crc   = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// IHDR
const ihdr = Buffer.allocUnsafe(13);
ihdr.writeUInt32BE(WIDTH,  0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8]  = 8;  // bit depth
ihdr[9]  = 6;  // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// IDAT
const compressed = deflateSync(raw);

// PNG file
const pngSig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
const png = Buffer.concat([
  pngSig,
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync(pngOut, png);
console.log('✅ Clean PNG written:', pngOut, '| Size:', png.length, 'bytes');

// ─── Verify PNG header ────────────────────────────────────────
const check = fs.readFileSync(pngOut).slice(0, 8);
const valid = check[0] === 0x89 && check[1] === 0x50 && check[2] === 0x4E && check[3] === 0x47;
console.log('PNG signature valid:', valid, '| Bytes:', check.toString('hex'));

// ─── Now generate ICO from clean PNG ─────────────────────────
const pngToIco = require('png-to-ico');
const fn = pngToIco.default || pngToIco;

fn([pngOut])
  .then(icoBuf => {
    fs.writeFileSync(icoOut, icoBuf);
    // Copy to all icon locations
    fs.copyFileSync(icoOut, path.resolve(__dirname, 'electron/assets/alx.ico'));
    console.log('✅ ICO created! Size:', icoBuf.length, 'bytes');
    console.log('✅ Copied to alx.ico');
    
    // Verify ICO header
    const icoCheck = fs.readFileSync(icoOut).slice(0, 6);
    console.log('ICO header (hex):', icoCheck.toString('hex'));
    console.log('ICO reserved:', icoCheck.readUInt16LE(0), '(should be 0)');
    console.log('ICO type:    ', icoCheck.readUInt16LE(2), '(should be 1)');
    console.log('ICO count:   ', icoCheck.readUInt16LE(4));
  })
  .catch(err => {
    console.error('❌ png-to-ico failed:', err.message);
    process.exit(1);
  });
