const router = require('express').Router();
const { protect } = require('../middleware/auth');
const h = require('../controllers/habitController');

router.use(protect);
router.route('/').get(h.list).post(h.create);
router.route('/:id').put(h.update).delete(h.remove);
router.put('/:id/checks', h.setCheck);

module.exports = router;
