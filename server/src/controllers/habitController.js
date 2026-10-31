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

// PUT /api/habits/:id/checks - sets a day cell { weekKey, day, checked }
// Setting an explicit value instead of toggling makes repeated requests safe
exports.setCheck = async (req, res, next) => {
    try {
        const { weekKey, day, checked } = req.body;
        if (typeof weekKey !== 'string' || typeof day !== 'string' || typeof checked !== 'boolean') {
            res.status(400); throw new Error('weekKey, day and checked are required');
        }
        const habit = await Habit.findOne({ _id: req.params.id, user: req.user._id });
        if (!habit) { res.status(404); throw new Error('Habit not found'); }

        const filter = { user: req.user._id, habit: habit._id, weekKey, day };
        if (checked) {
            // a duplicate key error just means the day is already checked
            await HabitCheck.create(filter).catch(err => { if (err.code !== 11000) throw err; });
        } else {
            await HabitCheck.deleteOne(filter);
        }
        res.json({ key: `${habit._id}_${weekKey}_${day}`, checked });
    } catch (err) { next(err); }
};
