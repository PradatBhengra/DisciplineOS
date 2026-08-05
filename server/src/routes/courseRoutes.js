const router = require('express').Router();
const { protect } = require('../middleware/auth');
const factory = require('../controllers/crudFactory');
const Course = require('../models/Course');

const c = factory(Course, ['name', 'instructor', 'credits']);
router.use(protect);
router.route('/').get(c.list).post(c.create);
router.route('/:id').put(c.update).delete(c.remove);

module.exports = router;
