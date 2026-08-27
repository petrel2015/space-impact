/* QR roundtrip test — run: node test/qr-roundtrip.test.js
   Renders each receive-money link with the exact algorithm the page uses
   (js/donation.js drawQrCode: auto type, ECC M, quiet zone 4, integer
   scale, #111 on #fff), then decodes the bitmap with jsQR and asserts
   the payload matches character-for-character. Needs jsqr + pngjs on
   NODE_PATH; skips with a notice when they are absent. The sample PNG
   for manual scan-checks goes to the OS temp dir — the repo never
   stores QR images. */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');

var jsQR, PNG;
try {
  jsQR = require('jsqr');
  PNG = require('pngjs').PNG;
} catch (e) {
  console.log('jsqr/pngjs not resolvable — skipping QR roundtrip ' +
    '(NODE_PATH=<dir with jsqr+pngjs> node test/qr-roundtrip.test.js)');
  process.exit(0);
}

/* static literal require — same module the browser lazy-loads */
var qrcode = require('../js/vendor/qrcode-generator.js');

/* mirror of js/donation.js drawing parameters */
var QR_DISPLAY_SIZE = 220;
var QR_ECC = 'M';
var QR_QUIET_MODULES = 4;

var EXPECTED = {
  alipay: 'https://qr.alipay.com/fkx16432isyyhmx9ttwpi79',
  wechat: 'wxp://f2f1fJpOcJc7F-MSeLMxALhc6tWu-oohtxueHRbCe98bMy2AmDunimuOJFv-8bjobLBM'
};

var pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}

function renderToPixels(content, scaleBoost) {
  var qr = qrcode(0, QR_ECC);
  qr.addData(content);
  qr.make();
  var modules = qr.getModuleCount();
  var total = modules + QR_QUIET_MODULES * 2;
  var px = Math.max(1, Math.floor(QR_DISPLAY_SIZE / total)) * (scaleBoost || 4);
  var size = px * total;
  var png = new PNG({ width: size, height: size });
  for (var i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255; png.data[i + 1] = 255; png.data[i + 2] = 255; png.data[i + 3] = 255;
  }
  for (var row = 0; row < modules; row++) {
    for (var col = 0; col < modules; col++) {
      if (!qr.isDark(row, col)) continue;
      var x0 = (col + QR_QUIET_MODULES) * px;
      var y0 = (row + QR_QUIET_MODULES) * px;
      for (var dy = 0; dy < px; dy++) {
        for (var dx = 0; dx < px; dx++) {
          var idx = (size * (y0 + dy) + (x0 + dx)) * 4;
          png.data[idx] = 17; png.data[idx + 1] = 17; png.data[idx + 2] = 17;
        }
      }
    }
  }
  return { png: png, modules: modules, total: total };
}

console.log('QR roundtrip (page algorithm + jsQR decode)');
Object.keys(EXPECTED).forEach(function (channel) {
  var content = EXPECTED[channel];
  console.log('— ' + channel);
  var r = renderToPixels(content);
  check('encoded with auto type selection (' + r.modules + ' modules)', r.modules >= 21 && r.modules <= 177);
  check('quiet zone ≥ 4 modules (total ' + r.total + ')', r.total - r.modules >= QR_QUIET_MODULES * 2);
  var decoded = jsQR(new Uint8ClampedArray(r.png.data), r.png.width, r.png.height);
  check('jsQR decoded', !!decoded);
  check('payload matches character-for-character', !!decoded && decoded.data === content);
});

var sample = renderToPixels(EXPECTED.alipay, 6);
var samplePath = path.join(os.tmpdir(), 'space-impact-qr-sample-alipay.png');
fs.writeFileSync(samplePath, PNG.sync.write(sample.png));
console.log('\nsample for manual scan check: ' + samplePath);
console.log('result: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
