const assert = require('assert');
const path = require('path');

process.env.DATABASE_FILE = path.join(__dirname, '..', 'tmp-test.sqlite');

(async () => {
  const db = require('../dist/db.js');
  await db.ensureSchema();
  const profile = await db.createProfile('tester');
  assert.strictEqual(profile.username, 'tester');

  const updated = await db.updateProfile({
    ...profile,
    currentPage: 100,
    totalPageCount: 800,
  });

  const reloaded = await db.getProfile('tester');
  assert.ok(reloaded);
  assert.strictEqual(reloaded.currentPage, 100);
  assert.strictEqual(reloaded.totalPageCount, 800);

  const allProfiles = await db.listAllProfiles();
  assert.ok(allProfiles.some((entry) => entry.username === 'tester' && entry.totalPageCount === 800));

  console.log('sqlite smoke test passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
