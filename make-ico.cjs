const Jimp = require('jimp');
const fs   = require('fs');
const path = require('path');

const src  = path.resolve('electron/assets/icon.png');  // in: JPEG (misnamed)
const pngOut = path.resolve('electron/assets/icon_real.png');
const icoOut = path.resolve('electron/assets/icon.ico');

// Jimp يقرأ JPEG ويتحول PNG
Jimp.read(src)
  .then(img => img.resize(256, 256).write(pngOut))
  .then(() => {
    console.log('PNG written:', pngOut);
    // الآن نستخدم png-to-ico
    const m  = require('png-to-ico');
    const fn = m.default || m;
    return fn([pngOut]);
  })
  .then(icoBuf => {
    fs.writeFileSync(icoOut, icoBuf);
    console.log('ICO created! Size:', icoBuf.length, 'bytes');
  })
  .catch(err => {
    console.error('Conversion failed:', err.message);
    // Fallback: electron-builder يقبل PNG أيضاً — ننسخ فقط
    if (fs.existsSync(pngOut)) {
      fs.copyFileSync(pngOut, icoOut);
      console.log('Fallback: copied PNG as ICO');
    }
  });
