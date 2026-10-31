const mongoose = require('mongoose');

// One document per (user, habit, week, day) that is checked.
// Unchecking deletes the document, so a missing doc just means "not done".
// weekKey is the local date of the week's Sunday, e.g. "2026-10-25".
const habitCheckSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    habit: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
    weekKey: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'weekKey must be a date (YYYY-MM-DD)'] },
    day: { type: String, required: true, enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
}, { timestamps: true });

habitCheckSchema.index({ user: 1, habit: 1, weekKey: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('HabitCheck', habitCheckSchema);
