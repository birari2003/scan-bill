const { Router } = require('express');
const authRoutes = require('./auth.routes');
const fileRoutes = require('./file.routes');
const billRoutes = require('./bill.routes');
const dashboardRoutes = require('./dashboard.routes');
const stockRoutes = require('./stock.routes');
const { health } = require('../controllers/health.controller');

const router = Router();

router.get('/health', health);
router.use('/auth', authRoutes);
router.use('/files', fileRoutes);
router.use('/bills', billRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/stocks', stockRoutes);

module.exports = router;
