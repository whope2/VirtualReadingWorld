const assert = require('assert');
const fs = require('fs');
const path = require('path');

const testDbFile = path.join(__dirname, '..', 'tmp-test.sqlite');
for (const candidate of [testDbFile, `${testDbFile}-wal`, `${testDbFile}-shm`]) {
  try {
    fs.rmSync(candidate, { force: true });
  } catch {
    // ignore cleanup failures for files that do not exist
  }
}

process.env.DATABASE_FILE = testDbFile;

(async () => {
  const db = require('../dist/db.js');
  await db.ensureSchema();
  const profile = await db.createProfile('tester');
  assert.strictEqual(profile.username, 'tester');

  const loginTimeUtc = Date.now();
  const avatarImageData = 'data:image/png;base64,' + 'A'.repeat(200000);
  const updated = await db.updateProfile({
    ...profile,
    currentPage: 100,
    totalPageCount: 800,
    loginTimeUtc,
    isActive: true,
    avatarImageData,
    books: [
      { ...profile.books[0], currentRating: 4.5, likeCount: 2 },
      { ...profile.books[1], currentRating: 3.5, likeCount: 1 },
      { ...profile.books[2], currentRating: 2, likeCount: 0 },
      { ...profile.books[3] },
    ],
    currentBookIndex: 0,
  });

  const reloaded = await db.getProfile('tester');
  assert.ok(reloaded);
  assert.strictEqual(reloaded.currentPage, 100);
  assert.strictEqual(reloaded.totalPageCount, 800);
  assert.strictEqual(reloaded.books[0].currentRating, 4.5);
  assert.strictEqual(reloaded.books[1].currentRating, 3.5);
  assert.strictEqual(reloaded.books[2].currentRating, 2);
  assert.strictEqual(reloaded.books[0].likeCount, 2);
  assert.strictEqual(reloaded.books[1].likeCount, 1);
  assert.strictEqual(reloaded.books[2].likeCount, 0);
  assert.strictEqual(reloaded.books[3].title, 'Between books');
  assert.strictEqual(reloaded.loginTimeUtc, loginTimeUtc);
  assert.strictEqual(reloaded.avatarImageData, avatarImageData);

  const firstStats = await db.recordDailyVisit('tester');
  assert.strictEqual(firstStats.visitCount, 1);
  assert.strictEqual(firstStats.userCount, 1);

  const secondStats = await db.recordDailyVisit('tester');
  assert.strictEqual(secondStats.visitCount, 2);
  assert.strictEqual(secondStats.userCount, 1);

  const thirdStats = await db.recordDailyVisit('reader-two');
  assert.strictEqual(thirdStats.visitCount, 3);
  assert.strictEqual(thirdStats.userCount, 2);

  const loadedStats = await db.getDailyVisitStats();
  assert.strictEqual(loadedStats.visitCount, 3);
  assert.strictEqual(loadedStats.userCount, 2);
  assert.strictEqual(loadedStats.totalReadingMinutes, 0);

  const sessionStartUtc = Date.now() - (95 * 60 * 1000);
  await db.updateProfile({
    ...reloaded,
    isActive: true,
    loginTimeUtc: sessionStartUtc,
  }, false);

  await db.updateProfile({
    ...reloaded,
    isActive: false,
    loginTimeUtc: 0,
  }, false);

  const statsAfterLeave = await db.getDailyVisitStats();
  assert.ok(statsAfterLeave.totalReadingMinutes >= 95);

  const bulletinImageData = 'data:image/jpeg;base64,' + 'B'.repeat(120000);
  const bulletinPost = await db.createDailyBulletinPost({
    author: 'tester',
    text: 'Today I am reading in the forest.',
    avatarIcon: '📚',
    avatarImageData,
    imageData: bulletinImageData,
  });
  assert.strictEqual(bulletinPost.author, 'tester');
  assert.strictEqual(bulletinPost.imageData, bulletinImageData);

  const bulletinPosts = await db.listDailyBulletinPosts();
  assert.strictEqual(bulletinPosts.length, 1);
  assert.strictEqual(bulletinPosts[0].text, 'Today I am reading in the forest.');
  assert.strictEqual(bulletinPosts[0].imageData, bulletinImageData);

  const forbiddenDelete = await db.deleteDailyBulletinPostByAuthor(bulletinPost.postId, 'reader-two');
  assert.strictEqual(forbiddenDelete, 'forbidden');

  const ownDelete = await db.deleteDailyBulletinPostByAuthor(bulletinPost.postId, 'tester');
  assert.strictEqual(ownDelete, 'deleted');

  const remainingBulletinPosts = await db.listDailyBulletinPosts();
  assert.strictEqual(remainingBulletinPosts.length, 0);

  const deactivated = await db.updateProfile({
    ...reloaded,
    isActive: false,
    loginTimeUtc: 0,
  }, false);
  assert.strictEqual(deactivated.loginTimeUtc, 0);

  const allProfiles = await db.listAllProfiles();
  assert.ok(allProfiles.some((entry) => entry.username === 'tester' && entry.totalPageCount === 800));

  console.log('sqlite smoke test passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
