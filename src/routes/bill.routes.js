const { Router } = require('express');
const billController = require('../controllers/bill.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateBillBody, billIdParams } = require('../validators/bill.validator');

const router = Router();

router.use(authenticate);
router.put('/:id', validate(billIdParams, 'params'), validate(updateBillBody), billController.update);

module.exports = router;
