const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo, server, base, token;

async function api(path, method = 'GET', body) {
    const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, body: await res.json() };
}

before(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    process.env.JWT_SECRET = 'test-secret';
    await require('../src/config/db')();
    const app = require('../src/app');
    // build unique indexes before the tests that rely on them
    await Promise.all(Object.values(mongoose.models).map(m => m.init()));
    await new Promise(resolve => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}/api`;
    const res = await api('/auth/register', 'POST', { name: 'Test User', email: 'test@example.com', password: 'secret123' });
    token = res.body.token;
});

after(async () => {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
});

test('malformed JSON gets a 400, not a 500', async () => {
    const res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    assert.strictEqual(res.status, 400);
});

test('login rejects a query operator in place of the email', async () => {
    const res = await api('/auth/login', 'POST', { email: { $regex: '.' }, password: 'secret123' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.token, undefined);
});

test('quick repeated attendance marks are all counted', async () => {
    const { body: subject } = await api('/attendance', 'POST', { name: 'Maths' });
    await Promise.all([1, 2, 3, 4, 5].map(() => api(`/attendance/${subject.id}/mark`, 'PATCH', { status: 'present' })));
    const { body: list } = await api('/attendance');
    const saved = list.find(a => a.id === subject.id);
    assert.strictEqual(saved.totalClasses, 5);
    assert.strictEqual(saved.attended, 5);
});

test('attended cannot be more than total classes', async () => {
    const res = await api('/attendance', 'POST', { name: 'Physics', totalClasses: 3, attended: 5 });
    assert.strictEqual(res.status, 400);
});

test('marks must be positive and fit within max marks', async () => {
    const ok = await api('/marks', 'POST', { name: 'FED', maxMarks: 100, quiz1: 10, midSem: 20, quiz2: 6, assignment: 4, endSem: 47 });
    assert.strictEqual(ok.body.total, 87);
    assert.strictEqual(ok.body.grade, 'A');
    assert.strictEqual((await api('/marks', 'POST', { name: 'Chem', maxMarks: 10, quiz1: 8, endSem: 5 })).status, 400);
    assert.strictEqual((await api('/marks', 'POST', { name: 'Bio', maxMarks: 10, quiz1: -2 })).status, 400);
});

test('setting a habit check is safe to repeat', async () => {
    const { body: habit } = await api('/habits', 'POST', { name: 'Read' });
    const cell = { weekKey: '2026-10-25', day: 'Mon' };
    const key = `${habit.id}_2026-10-25_Mon`;

    const results = await Promise.all([1, 2].map(() => api(`/habits/${habit.id}/checks`, 'PUT', { ...cell, checked: true })));
    assert.deepStrictEqual(results.map(r => r.status), [200, 200]);
    assert.strictEqual((await api('/data')).body.habitChecks[key], true);

    await api(`/habits/${habit.id}/checks`, 'PUT', { ...cell, checked: false });
    assert.strictEqual((await api('/data')).body.habitChecks[key], undefined);
});

test('habit checks need the new week key format', async () => {
    const { body: habit } = await api('/habits', 'POST', { name: 'Gym' });
    const res = await api(`/habits/${habit.id}/checks`, 'PUT', { weekKey: '2026W925', day: 'Mon', checked: true });
    assert.strictEqual(res.status, 400);
});

test('todo deadline must be a date or empty', async () => {
    assert.strictEqual((await api('/todos', 'POST', { name: 'Essay', deadline: '<img src=x onerror=alert(1)>' })).status, 400);
    assert.strictEqual((await api('/todos', 'POST', { name: 'Essay', deadline: '2026-11-02' })).status, 201);
    assert.strictEqual((await api('/todos', 'POST', { name: 'Essay', deadline: '' })).status, 201);
});

test('old week keys convert to the date of their Sunday', () => {
    const { convert } = require('../scripts/migrate-week-keys');
    assert.strictEqual(convert('2026W925'), '2026-10-25');
    assert.strictEqual(convert('2026W011'), '2026-01-11');
    assert.strictEqual(convert('2026W116'), '2026-12-06');
    assert.strictEqual(convert('2028W113'), null); // Feb 13 or Dec 3, both Sundays
});
