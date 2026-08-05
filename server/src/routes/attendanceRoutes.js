const router = require('express').Router();
const { protect } = require('../middleware/auth');
const a = require('../controllers/attendanceController');

router.use(protect);
router.route('/').get(a.list).post(a.create);
router.route('/:id').put(a.update).delete(a.remove);
router.patch('/:id/mark', a.mark);

module.exports = router;
