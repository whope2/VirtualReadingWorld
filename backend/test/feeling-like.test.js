const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrw-feeling-like-'));
process.env.DATABASE_FILE = path.join(testDir, 'test.sqlite');
process.env.DB_TYPE = 'sqlite';

(async () => {
  const db = require('../dist/db.js');
  const { app } = require('../dist/index.js');
  await db.ensureSchema();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (pathName, method = 'GET', body) => {
    const response = await fetch(`${base}${pathName}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    const profile = (await request('/profile/feeling-test')).data;
    const books = profile.books.map((book, index) => index === 0
      ? { ...book, title: 'Test book', feeling: 'A lovely read.' }
      : book);
    const saved = await request('/profile/feeling-test', 'PUT', { books, currentBookIndex: 0 });
    assert.equal(saved.status, 200);
    const endpoint = '/profile/feeling-test/books/0/feeling-like';
    const body = { title: 'Test book', feeling: 'A lovely read.' };
    assert.equal((await request(endpoint, 'POST', body)).data.feelingLikeCount, 1);
    const reloaded = await request('/profile/feeling-test');
    assert.equal(reloaded.data.books[0].feelingLikeCount, 1);
    assert.equal(reloaded.data.books[0].likeCount, 0);
    assert.equal((await request(endpoint, 'DELETE', body)).data.feelingLikeCount, 0);
    assert.equal((await request(endpoint, 'DELETE', body)).data.feelingLikeCount, 0);
    await request(endpoint, 'POST', body);
    const unchanged = await request('/profile/feeling-test', 'PUT', { status: 'Reading' });
    assert.equal(unchanged.data.books[0].feelingLikeCount, 1);
    const updatedBooks = unchanged.data.books.map((book, index) => index === 0 ? { ...book, feeling: 'A new feeling.' } : book);
    const updated = await request('/profile/feeling-test', 'PUT', { books: updatedBooks });
    assert.equal(updated.data.books[0].feelingLikeCount, 0);
    assert.equal((await request(endpoint, 'POST', body)).status, 409);
    assert.equal((await request(endpoint, 'POST', { title: 'Test book', feeling: '' })).status, 400);
    assert.equal((await request('/profile/feeling-test/books/4/feeling-like', 'POST', body)).status, 400);
    console.log('feeling-like API test passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(testDir, { recursive: true, force: true });
  }
})().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});