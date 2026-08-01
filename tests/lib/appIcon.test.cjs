const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const svg = fs.readFileSync(path.join(root, 'assets', 'branding', 'vinha-icon.svg'), 'utf8');
const generator = fs.readFileSync(path.join(root, 'scripts', 'generate_app_icons.ps1'), 'utf8');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

function asset(relative) {
  return path.join(root, relative.replace(/^\.\//, '').split('/').join(path.sep));
}

/** Width and height from a PNG's IHDR, without pulling in a decoder. */
function pngSize(relative) {
  const head = fs.readFileSync(asset(relative)).subarray(0, 33);
  assert.equal(head.subarray(1, 4).toString('ascii'), 'PNG', `${relative} is not a PNG`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

module.exports = [
  {
    name: 'the icon renderer still matches the vector source it claims to render',
    run() {
      // The generator carries the geometry as numbers rather than parsing the
      // SVG, so nothing stops the two drifting apart — and a drifted renderer
      // does not fail loudly, it just quietly produces a slightly wrong icon.
      // Every number the renderer holds is checked against the source here.
      assert.match(svg, /fill="#101828"/);
      assert.match(generator, /0x10, 0x18, 0x28/);
      assert.match(svg, /stroke="#8B5CF6"/);
      assert.match(generator, /0x8B, 0x5C, 0xF6/);

      assert.match(svg, /d="M330 264 L512 724 L694 264"/);
      assert.match(generator, /PointF 330, 264/);
      assert.match(generator, /PointF 512, 724/);
      assert.match(generator, /PointF 694, 264/);

      assert.match(svg, /stroke-width="126"/);
      assert.match(generator, /\$STROKE = 126\.0/);
      assert.match(svg, /transform="skewX\(-7\) translate\(36 0\)"/);
      assert.match(generator, /\$SKEW_DEG = -7\.0/);
      assert.match(generator, /\$SHIFT_X = 36\.0/);

      assert.match(svg, /transform="rotate\(-16 512 512\)"/);
      assert.match(generator, /\$CUT_ROTATION_DEG = -16\.0/);
      assert.match(svg, /y="392"[^>]*height="30"/);
      assert.match(svg, /y="606"[^>]*height="30"/);
      assert.match(generator, /\$CUT_TOPS = @\(392\.0, 606\.0\)/);
      assert.match(generator, /\$CUT_HEIGHT = 30\.0/);

      // Android shows the middle 72 of a 108dp foreground. Written as the ratio
      // rather than 0.667 so it stays legible as the reason, not a magic number.
      assert.match(generator, /\$ADAPTIVE_SCALE = 72\.0 \/ 108\.0/);
    },
  },
  {
    name: 'every icon app.json points at exists, at the size that slot needs',
    run() {
      const expo = appJson.expo;

      // The store master must be square and 1024: Apple rejects anything else,
      // and it must carry no rounding of its own.
      assert.equal(expo.icon, './assets/icon.png');
      assert.deepEqual(pngSize(expo.icon), { width: 1024, height: 1024 });

      const adaptive = expo.android.adaptiveIcon;
      assert.deepEqual(pngSize(adaptive.foregroundImage), { width: 1024, height: 1024 });
      assert.deepEqual(pngSize(adaptive.monochromeImage), { width: 1024, height: 1024 });
      // A backgroundImage would win over backgroundColor, so having both is a
      // way to change the colour and see nothing happen.
      assert.equal(adaptive.backgroundImage, undefined);
      assert.equal(adaptive.backgroundColor, '#101828');

      assert.ok(fs.existsSync(asset(expo.web.favicon)), 'favicon is missing');
      assert.ok(fs.existsSync(asset(expo.splash.image)), 'splash image is missing');

      // Android draws the notification icon as a white silhouette; a coloured
      // or opaque one comes out as a solid white square.
      const notifications = expo.plugins.find(
        (entry) => Array.isArray(entry) && entry[0] === 'expo-notifications',
      );
      assert.ok(notifications, 'expo-notifications is not configured with an icon');
      assert.ok(fs.existsSync(asset(notifications[1].icon)), 'notification icon is missing');
    },
  },
  {
    name: 'the retired GAINER art is gone, and nothing still asks for it',
    run() {
      const branding = fs.readdirSync(path.join(root, 'assets', 'branding'));
      assert.deepEqual(
        branding.filter((name) => /gainer/i.test(name)),
        [],
        'a GAINER-era file is still in assets/branding',
      );

      const referenced = [
        path.join('src', 'screens', 'HealthConnectScreen.tsx'),
        'app.json',
      ];
      for (const file of referenced) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        assert.doesNotMatch(source, /gainer/i, `${file} still points at a GAINER asset`);
      }
    },
  },
];
