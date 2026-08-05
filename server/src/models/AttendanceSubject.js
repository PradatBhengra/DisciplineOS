const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Subject name is required'], trim: true, maxlength: 100 },
    totalClasses: { type: Number, min: 0, default: 0 },
    attended: { type: Number, min: 0, default: 0 }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

attendanceSchema.virtual('percentage').get(function () {
    return this.totalClasses > 0 ? Math.round((this.attended / this.totalClasses) * 100) : 0;
});

module.exports = mongoose.model('AttendanceSubject', attendanceSchema);
