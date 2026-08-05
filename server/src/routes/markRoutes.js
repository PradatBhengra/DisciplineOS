const router = require('express').Router();
const { protect } = require('../middleware/auth');
const factory = require('../controllers/crudFactory');
const Mark = require('../models/Mark');

const c = factory(Mark, ['name', 'maxMarks', 'quiz1', 'midSem', 'quiz2', 'assignment', 'endSem']);
router.use(protect);
router.route('/').get(c.list).post(c.create);
router.route('/:id').put(c.update).delete(c.remove);

module.exports = router;
