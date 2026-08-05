const router = require('express').Router();
const { protect } = require('../middleware/auth');
const factory = require('../controllers/crudFactory');
const Todo = require('../models/Todo');

const c = factory(Todo, ['name', 'deadline', 'estimatedHours', 'done']);
router.use(protect);
router.route('/').get(c.list).post(c.create);
router.route('/:id').put(c.update).delete(c.remove);

module.exports = router;
