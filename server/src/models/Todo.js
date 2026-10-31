const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Task name is required'], trim: true, maxlength: 200 },
    deadline: { type: String, default: '', match: [/^(\d{4}-\d{2}-\d{2})?$/, 'Deadline must be a date (YYYY-MM-DD)'] },
    estimatedHours: { type: Number, min: 0, default: null },
    done: { type: Boolean, default: false }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('Todo', todoSchema);
