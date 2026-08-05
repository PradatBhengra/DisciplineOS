const Course = require('../models/Course');
const Mark = require('../models/Mark');
const Todo = require('../models/Todo');
const Habit = require('../models/Habit');
const HabitCheck = require('../models/HabitCheck');
const AttendanceSubject = require('../models/AttendanceSubject');

// GET /api/data - loads everything for the logged in user in one request
exports.bootstrap = async (req, res, next) => {
    try {
        const uid = req.user._id;
        const [courses, marks, todos, habits, checks, attendance] = await Promise.all([
            Course.find({ user: uid }).sort('createdAt'),
            Mark.find({ user: uid }).sort('createdAt'),
            Todo.find({ user: uid }).sort('createdAt'),
            Habit.find({ user: uid }).sort('createdAt'),
            HabitCheck.find({ user: uid }),
            AttendanceSubject.find({ user: uid }).sort('createdAt')
        ]);
        // Flatten checks to { "<habitId>_<weekKey>_<day>": true } for the client
        const habitChecks = {};
        checks.forEach(c => { habitChecks[`${c.habit}_${c.weekKey}_${c.day}`] = true; });
        res.json({ courses, marks, todos, habits, habitChecks, attendance });
    } catch (err) { next(err); }
};
