'use strict';

const fs   = require('fs');
const path = require('path');

const pngSrc = path.resolve(__dirname, 'electron/assets/icon.png');
const icoOut = path.resolve(__dirname, 'electron/assets/icon.ico');

console.log('Source PNG:', pngSrc, '| exists:', fs.existsSync(pngSrc));

// استخدم png-to-ico مباشرة
const pngToIco = require('png-to-ico');
const fn = pngToIco.default || pngToIco;

fn([pngSrc])
  .then(buf => {
    fs.writeFileSync(icoOut, buf);
    const stat = fs.statSync(icoOut);
    console.log('✅ ICO created successfully! Size:', stat.size, 'bytes at:', icoOut);
  })
  .catch(err => {
    console.error('❌ png-to-ico failed:', err.message);
    // Fallback: نسخ PNG مباشرة (electron-builder يقبل PNG)
    console.log('Trying fallback: using PNG directly...');
    fs.copyFileSync(pngSrc, icoOut);
    console.log('PNG copied as ICO fallback. Size:', fs.statSync(icoOut).size, 'bytes');
  });
