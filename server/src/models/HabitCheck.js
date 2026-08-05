const mongoose = require('mongoose');

// One document per (user, habit, week, day) that is checked.
// Unchecking deletes the document, so a missing doc just means "not done".
const habitCheckSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    habit: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
    weekKey: { type: String, required: true },
    day: { type: String, required: true, enum: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
}, { timestamps: true });

habitCheckSchema.index({ user: 1, habit: 1, weekKey: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('HabitCheck', habitCheckSchema);
