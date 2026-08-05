const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { bootstrap } = require('../controllers/dataController');

router.get('/', protect, bootstrap);

module.exports = router;
