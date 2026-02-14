const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(path.resolve(root, src), path.resolve(root, dest));
}

function copyDir(src, dest) {
  const srcPath = path.resolve(root, src);
  const destPath = path.resolve(root, dest);
  fs.cpSync(srcPath, destPath, { recursive: true });
}

// Create target directories
mkdirp(path.resolve(root, 'src/lib/pdfjs'));

// Copy pdfjs-dist files
copyFile('node_modules/pdfjs-dist/build/pdf.mjs', 'src/lib/pdfjs/pdf.mjs');
copyFile('node_modules/pdfjs-dist/build/pdf.worker.mjs', 'src/lib/pdfjs/pdf.worker.mjs');
copyDir('node_modules/pdfjs-dist/cmaps', 'src/lib/pdfjs/cmaps');
copyDir('node_modules/pdfjs-dist/standard_fonts', 'src/lib/pdfjs/standard_fonts');

// Copy fabric and pdf-lib
copyFile('node_modules/fabric/dist/fabric.min.js', 'src/lib/fabric.min.js');
copyFile('node_modules/pdf-lib/dist/pdf-lib.min.js', 'src/lib/pdf-lib.min.js');

// Patch pdf.worker.mjs for CJK font rendering
const workerPath = path.resolve(root, 'src/lib/pdfjs/pdf.worker.mjs');
let workerSrc = fs.readFileSync(workerPath, 'utf8');
workerSrc = workerSrc.replace(
  'properties.composite && (properties.cidToGidMap?.length > 0 || !(properties.cMap instanceof IdentityCMap))',
  'properties.composite'
);
fs.writeFileSync(workerPath, workerSrc);

console.log('copy-libs: done');
