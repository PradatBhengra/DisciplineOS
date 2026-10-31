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
        // $inc is atomic, so two quick taps can't overwrite each other's count
        const doc = await AttendanceSubject.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { $inc: { totalClasses: 1, attended: status === 'present' ? 1 : 0 } },
            { new: true }
        );
        if (!doc) { res.status(404); throw new Error('Not found'); }
        res.json(doc);
    } catch (err) { next(err); }
};
