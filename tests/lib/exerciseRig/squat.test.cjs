const assert = require('node:assert/strict');

const { squatAngles, computeSquatSkeleton } = require('../../../.test-dist/lib/exerciseRig/squat.js');

module.exports = [
  {
    name: 'squatAngles scale linearly with t (documented convention)',
    run() {
      assert.deepEqual(squatAngles(0), { shinLeanDeg: 0, hipFlexDeg: 0, torsoLeanDeg: 0 });
      assert.deepEqual(squatAngles(1), { shinLeanDeg: 32, hipFlexDeg: 100, torsoLeanDeg: 45 });
      assert.deepEqual(squatAngles(0.5), { shinLeanDeg: 16, hipFlexDeg: 50, torsoLeanDeg: 22.5 });
      // t is clamped to [0,1].
      assert.deepEqual(squatAngles(-1), { shinLeanDeg: 0, hipFlexDeg: 0, torsoLeanDeg: 0 });
      assert.deepEqual(squatAngles(9), { shinLeanDeg: 32, hipFlexDeg: 100, torsoLeanDeg: 45 });
    },
  },
  {
    name: 'standing pose (t=0): legs vertical, torso upright, tall stack',
    run() {
      const s = computeSquatSkeleton(0);
      // Ankle fixed.
      assert.equal(s.ankleL.x, -0.18);
      assert.equal(s.ankleR.x, 0.18);
      assert.ok(Math.abs(s.ankleL.y - 0.09) < 1e-9);
      // No lean → knee directly above ankle (z ≈ ankle z), hip above knee.
      assert.ok(Math.abs(s.kneeL.z - s.ankleL.z) < 1e-9, 'knee not forward when standing');
      assert.ok(Math.abs(s.hipL.z - s.kneeL.z) < 1e-9, 'hip not back when standing');
      assert.ok(s.kneeL.y > s.ankleL.y && s.hipL.y > s.kneeL.y, 'leg not stacked upward');
      // Torso upright → chest directly above pelvis.
      assert.ok(Math.abs(s.chest.z - s.pelvis.z) < 1e-9, 'torso leaning when standing');
      assert.ok(s.chest.y > s.pelvis.y, 'chest not above pelvis');
      // Standing hip height ≈ 0.09 + 0.43 + 0.44 = 0.96.
      assert.ok(Math.abs(s.hipL.y - 0.96) < 1e-9);
    },
  },
  {
    name: 'bottom pose (t=1): hips drop, knees travel forward, torso leans in',
    run() {
      const top = computeSquatSkeleton(0);
      const bottom = computeSquatSkeleton(1);
      // Hips drop at the bottom.
      assert.ok(bottom.hipL.y < top.hipL.y, 'hips did not drop');
      assert.ok(bottom.pelvis.y < top.pelvis.y);
      // Knees travel forward (+z).
      assert.ok(bottom.kneeL.z > top.kneeL.z + 0.05, 'knees did not move forward');
      // Torso leans forward → chest ahead of pelvis in z.
      assert.ok(bottom.chest.z > bottom.pelvis.z + 0.1, 'torso did not lean forward');
      // Bar follows the shoulders down.
      assert.ok(bottom.barCenter.y < top.barCenter.y, 'bar did not follow shoulders down');
      // Bar stays behind the chest (high-bar), just above it.
      assert.ok(bottom.barCenter.z < bottom.chest.z, 'bar not behind chest');
      assert.ok(bottom.barCenter.y > bottom.chest.y, 'bar not above chest');
    },
  },
  {
    name: 'hip height is monotonic in t (deeper = lower)',
    run() {
      let prev = Infinity;
      for (let i = 0; i <= 10; i += 1) {
        const s = computeSquatSkeleton(i / 10);
        assert.ok(s.hipL.y < prev, `hip height not decreasing at t=${i / 10}`);
        prev = s.hipL.y;
      }
    },
  },
  {
    name: 'bodyweight variant reaches the arms forward instead of holding a bar',
    run() {
      const loaded = computeSquatSkeleton(0.5, 'barbell');
      const body = computeSquatSkeleton(0.5, 'bodyweight');
      // Legs and torso are identical — only the upper body differs.
      assert.deepEqual(body.kneeL, loaded.kneeL);
      assert.deepEqual(body.hipL, loaded.hipL);
      assert.deepEqual(body.chest, loaded.chest);
      // Bodyweight: hands reach forward (+z) well ahead of the chest.
      assert.ok(body.handL.z > body.chest.z + 0.3, 'bodyweight hands not reaching forward');
      // Loaded: hands stay back on the bar, behind the chest.
      assert.ok(loaded.handL.z < loaded.chest.z, 'barbell hands not behind the chest');
      // Hands stay near shoulder width rather than out on the sleeves.
      assert.ok(Math.abs(body.handL.x) < Math.abs(loaded.handL.x), 'bodyweight grip not narrower');
      // Default stays the loaded variant (back-compat for existing callers).
      assert.deepEqual(computeSquatSkeleton(0.5), loaded);
    },
  },
  {
    name: 'left/right symmetry: mirrored on x, identical y and z',
    run() {
      const s = computeSquatSkeleton(0.6);
      const pairs = [
        ['ankleL', 'ankleR'],
        ['kneeL', 'kneeR'],
        ['hipL', 'hipR'],
        ['shoulderL', 'shoulderR'],
        ['elbowL', 'elbowR'],
        ['handL', 'handR'],
        ['footL', 'footR'],
      ];
      for (const [l, r] of pairs) {
        assert.ok(Math.abs(s[l].x + s[r].x) < 1e-9, `${l}/${r} not mirrored on x`);
        assert.ok(Math.abs(s[l].y - s[r].y) < 1e-9, `${l}/${r} y differs`);
        assert.ok(Math.abs(s[l].z - s[r].z) < 1e-9, `${l}/${r} z differs`);
      }
      // Centre joints sit on x=0.
      for (const j of ['pelvis', 'chest', 'head', 'barCenter']) {
        assert.ok(Math.abs(s[j].x) < 1e-9, `${j} not centred`);
      }
    },
  },
];
