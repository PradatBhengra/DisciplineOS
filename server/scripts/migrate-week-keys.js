// One-off migration for habit checks saved with the old week key format.
// Old keys glued year, 0-based month and day together ("2026W925"), so some weeks
// collided (Feb 13 and Dec 3 2028 were both "2028W113"). New keys are the Sunday's
// date, e.g. "2026-10-25". Safe to run more than once.
// Usage: cd server && npm run migrate:week-keys
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const HabitCheck = require('../src/models/HabitCheck');

const pad = n => String(n).padStart(2, '0');

// "2026W925" -> "2026-10-25". Tries both month/day splits and keeps the one that is a
// Sunday, since old keys were always a Sunday. Returns null if it can't tell.
function convert(oldKey) {
    const [year, digits] = oldKey.split('W');
    const found = [];
    for (const i of [1, 2]) {
        const m = digits.slice(0, i), d = digits.slice(i);
        if (!/^(\d|1[01])$/.test(m) || !/^[1-9]\d?$/.test(d)) continue;
        const date = new Date(Number(year), Number(m), Number(d));
        if (date.getMonth() === Number(m) && date.getDay() === 0) found.push(`${year}-${pad(Number(m) + 1)}-${pad(Number(d))}`);
    }
    return found.length === 1 ? found[0] : null;
}

async function migrate() {
    await mongoose.connect(process.env.MONGO_URI);
    const old = await HabitCheck.find({ weekKey: /W/ });
    let moved = 0;
    for (const check of old) {
        const weekKey = convert(check.weekKey);
        if (!weekKey) { console.warn(`Skipped ${check._id}: can't tell which week "${check.weekKey}" is`); continue; }
        try {
            await HabitCheck.updateOne({ _id: check._id }, { weekKey });
        } catch (err) {
            if (err.code !== 11000) throw err;
            await check.deleteOne(); // that day is already saved under the new key
        }
        moved++;
    }
    console.log(`Migrated ${moved} of ${old.length} old habit checks`);
    await mongoose.disconnect();
}

if (require.main === module) migrate();

module.exports = { convert };
