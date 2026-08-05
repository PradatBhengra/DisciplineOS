const AttendanceSubject = require('../models/AttendanceSubject');
const factory = require('./crudFactory');

const crud = factory(AttendanceSubject, ['name', 'totalClasses', 'attended']);
exports.list = crud.list;
exports.create = crud.create;
exports.update = crud.update;
exports.remove = crud.remove;

// PATCH /api/attendance/:id/mark  { status: 'present' | 'absent' }
exports.mark = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['present', 'absent'].includes(status)) { res.status(400); throw new Error('status must be present or absent'); }
        const doc = await AttendanceSubject.findOne({ _id: req.params.id, user: req.user._id });
        if (!doc) { res.status(404); throw new Error('Not found'); }
        doc.totalClasses += 1;
        if (status === 'present') doc.attended += 1;
        await doc.save();
        res.json(doc);
    } catch (err) { next(err); }
};
