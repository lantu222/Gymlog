const assert = require('node:assert/strict');

const { createSeedDatabase } = require('../../.test-dist/data/seed.js');
const { getActivePlan } = require('../../.test-dist/lib/progression.js');

module.exports = [
  {
    name: 'active plan comes only from preferences.activePlanId after first-run setup flows',
    run() {
      const database = createSeedDatabase();
      database.preferences.activePlanId = null;

      assert.equal(getActivePlan(database), null);
    },
  },
];
