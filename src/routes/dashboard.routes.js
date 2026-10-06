const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/stats', authenticate, dashboardController.stats);

module.exports = router;
