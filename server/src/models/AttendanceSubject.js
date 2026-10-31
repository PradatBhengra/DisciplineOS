const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Subject name is required'], trim: true, maxlength: 100 },
    totalClasses: { type: Number, min: 0, default: 0 },
    attended: { type: Number, min: 0, default: 0 }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Checked here rather than on the field so it also runs when only totalClasses changes
attendanceSchema.pre('validate', function (next) {
    if (this.attended > this.totalClasses) this.invalidate('attended', 'Attended cannot be more than total classes');
    next();
});

attendanceSchema.virtual('percentage').get(function () {
    return this.totalClasses > 0 ? Math.round((this.attended / this.totalClasses) * 100) : 0;
});

module.exports = mongoose.model('AttendanceSubject', attendanceSchema);
