const { Router } = require('express');
const stockController = require('../controllers/stock.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);

router.get('/', stockController.getAll);
router.get('/:id', stockController.getById);
router.post('/', stockController.create);
router.put('/:id', stockController.update);
router.delete('/:id', stockController.remove);

module.exports = router;
