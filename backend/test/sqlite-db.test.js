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
  const firstCover = 'data:image/png;base64,Zmlyc3Q=';
  const secondCover = 'data:image/jpeg;base64,c2Vjb25k';
  const updated = await db.updateProfile({
    ...profile,
    currentPage: 100,
    totalPageCount: 800,
    loginTimeUtc,
    isActive: true,
    avatarImageData,
    aboutMeBio: 'Reader, gardener, and collector of quiet mornings.',
    aboutMeLink: 'https://example.com/reader',
    books: [
      { ...profile.books[0], currentRating: 4.5, likeCount: 2, imageData: firstCover, feeling: 'Quietly absorbing so far.', feelingLikeCount: 3 },
      { ...profile.books[1], currentRating: 3.5, likeCount: 1, imageData: secondCover },
      { ...profile.books[2], currentRating: 2, likeCount: 0 },
      { ...profile.books[3], title: 'Book Four', author: 'Fourth Author', currentProgress: 12, totalProgress: 240 },
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
  assert.strictEqual(reloaded.books[0].imageData, firstCover);
  assert.strictEqual(reloaded.books[0].feeling, 'Quietly absorbing so far.');
  assert.strictEqual(reloaded.books[0].feelingLikeCount, 3);
  assert.strictEqual(reloaded.books[1].feelingLikeCount, 0);
  assert.strictEqual(reloaded.books[1].imageData, secondCover);
  assert.strictEqual(reloaded.books[2].imageData, '');
  assert.strictEqual(reloaded.books[3].title, 'Book Four');
  assert.strictEqual(reloaded.currentBookIndex, 0);
  assert.strictEqual(reloaded.loginTimeUtc, loginTimeUtc);
  assert.strictEqual(reloaded.avatarImageData, avatarImageData);
  assert.strictEqual(reloaded.aboutMeBio, 'Reader, gardener, and collector of quiet mornings.');
  assert.strictEqual(reloaded.aboutMeLink, 'https://example.com/reader');

  const betweenBooks = await db.updateProfile({
    ...reloaded,
    currentBook: 'Between books',
    currentAuthor: '',
    currentPage: 0,
    totalPageCount: 0,
    currentBookIndex: 4,
  });
  assert.strictEqual(betweenBooks.currentBook, 'Between books');
  assert.strictEqual(betweenBooks.currentBookIndex, 4);
  assert.strictEqual(betweenBooks.books.length, 4);
  assert.strictEqual(betweenBooks.books[3].title, 'Book Four');

  const legacyBetweenBooks = await db.updateProfile({
    ...reloaded,
    currentBook: 'Between books',
    currentAuthor: '',
    currentPage: 0,
    totalPageCount: 0,
    currentBookIndex: 3,
    books: [
      ...reloaded.books.slice(0, 3),
      { ...reloaded.books[3], title: 'Between books', author: '', currentProgress: 0, totalProgress: 0 },
    ],
  });
  assert.strictEqual(legacyBetweenBooks.currentBook, 'Between books');
  assert.strictEqual(legacyBetweenBooks.currentBookIndex, 4);
  assert.strictEqual(legacyBetweenBooks.books.length, 4);
  assert.strictEqual(legacyBetweenBooks.books[3].title, '');

  await db.recordLoginStreak('tester');
  await db.recordDailyVisit('observer-only');
  const todayReaders = await db.listTodayChatReaders();
  assert.ok(todayReaders.some((reader) => reader.username === 'tester' && reader.avatarImageData === avatarImageData));
  assert.ok(!todayReaders.some((reader) => reader.username === 'observer-only'));

  const firstStats = await db.recordDailyVisit('tester');
  assert.strictEqual(firstStats.visitCount, 2);
  assert.strictEqual(firstStats.userCount, 2);

  const secondStats = await db.recordDailyVisit('tester');
  assert.strictEqual(secondStats.visitCount, 3);
  assert.strictEqual(secondStats.userCount, 2);

  const thirdStats = await db.recordDailyVisit('reader-two');
  assert.strictEqual(thirdStats.visitCount, 4);
  assert.strictEqual(thirdStats.userCount, 3);

  const loadedStats = await db.getDailyVisitStats();
  assert.strictEqual(loadedStats.visitCount, 4);
  assert.strictEqual(loadedStats.userCount, 3);
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
