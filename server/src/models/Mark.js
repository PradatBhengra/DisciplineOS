const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Subject name is required'], trim: true, maxlength: 100 },
    maxMarks: { type: Number, min: 0, default: 0 },
    quiz1: { type: Number, default: null },
    midSem: { type: Number, default: null },
    quiz2: { type: Number, default: null },
    assignment: { type: Number, default: null },
    endSem: { type: Number, default: null }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// total and grade are computed here so the client can never store a wrong value
markSchema.virtual('total').get(function () {
    return [this.quiz1, this.midSem, this.quiz2, this.assignment, this.endSem]
        .reduce((s, v) => s + (Number(v) || 0), 0);
});

markSchema.virtual('grade').get(function () {
    if (!this.maxMarks || this.maxMarks <= 0) return 'N/A';
    const pct = (this.total / this.maxMarks) * 100;
    if (pct >= 75) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 45) return 'C';
    if (pct > 0) return 'D';
    return 'F';
});

module.exports = mongoose.model('Mark', markSchema);
