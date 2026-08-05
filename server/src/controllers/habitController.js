const Habit = require('../models/Habit');
const HabitCheck = require('../models/HabitCheck');
const factory = require('./crudFactory');

const crud = factory(Habit, ['name']);
exports.list = crud.list;
exports.create = crud.create;
exports.update = crud.update;

// Deleting a habit also removes its check history
exports.remove = async (req, res, next) => {
    try {
        const doc = await Habit.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!doc) { res.status(404); throw new Error('Not found'); }
        await HabitCheck.deleteMany({ user: req.user._id, habit: req.params.id });
        res.json({ id: req.params.id, deleted: true });
    } catch (err) { next(err); }
};

// PUT /api/habits/:id/checks - toggles a day cell { weekKey, day }
exports.toggleCheck = async (req, res, next) => {
    try {
        const { weekKey, day } = req.body;
        if (!weekKey || !day) { res.status(400); throw new Error('weekKey and day are required'); }
        const habit = await Habit.findOne({ _id: req.params.id, user: req.user._id });
        if (!habit) { res.status(404); throw new Error('Habit not found'); }

        const filter = { user: req.user._id, habit: habit._id, weekKey, day };
        const existing = await HabitCheck.findOne(filter);
        if (existing) {
            await existing.deleteOne();
            return res.json({ key: `${habit._id}_${weekKey}_${day}`, checked: false });
        }
        await HabitCheck.create(filter);
        res.json({ key: `${habit._id}_${weekKey}_${day}`, checked: true });
    } catch (err) { next(err); }
};
