const assert = require('node:assert/strict');

const { liveSessionBlocksProgrammeDelete } = require('../../.test-dist/lib/programmeDeletion.js');

/**
 * Deleting your own programme while one of its days is running locked the
 * reader out of that session: the player is routed by the programme's id, the
 * route guard bounced it, and the sets logged so far could never be saved
 * (live-session audit, 2026-09-20). The delete is refused while that holds.
 */
module.exports = [
  {
    name: 'programme deletion: refused while a workout of that programme is running or paused',
    run() {
      assert.equal(liveSessionBlocksProgrammeDelete({ templateId: 'custom_1', status: 'active' }, 'custom_1'), true);
      assert.equal(liveSessionBlocksProgrammeDelete({ templateId: 'custom_1', status: 'paused' }, 'custom_1'), true);
    },
  },
  {
    name: 'programme deletion: allowed with no workout, another programme\'s workout, or one already saved',
    run() {
      assert.equal(liveSessionBlocksProgrammeDelete(null, 'custom_1'), false);
      assert.equal(liveSessionBlocksProgrammeDelete(undefined, 'custom_1'), false);
      assert.equal(liveSessionBlocksProgrammeDelete({ templateId: 'custom_2', status: 'active' }, 'custom_1'), false);
      // Finished and saved, waiting on its summary: nothing left to lose.
      assert.equal(liveSessionBlocksProgrammeDelete({ templateId: 'custom_1', status: 'completed' }, 'custom_1'), false);
    },
  },
];
