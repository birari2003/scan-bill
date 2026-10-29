const { Router } = require('express');
const modelController = require('../controllers/model.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { modelBody, modelIdParams } = require('../validators/model.validator');

const router = Router();

router.use(authenticate);

router.get('/', modelController.getAll);
router.get('/:id', validate(modelIdParams, 'params'), modelController.getById);
router.post('/', validate(modelBody), modelController.create);
router.put('/:id', validate(modelIdParams, 'params'), validate(modelBody), modelController.update);
router.delete('/:id', validate(modelIdParams, 'params'), modelController.remove);

module.exports = router;
