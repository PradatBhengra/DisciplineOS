const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Course name is required'], trim: true, maxlength: 100 },
    instructor: { type: String, trim: true, default: '', maxlength: 100 },
    credits: { type: Number, min: 0, default: 0 }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('Course', courseSchema);
