const { Router } = require('express');
const fileController = require('../controllers/file.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { uploadSingle } = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');
const { listFilesQuery, recentFilesQuery, fileIdParams } = require('../validators/file.validator');

const router = Router();

// Loaded by <img>/<iframe>; authorised by a signed token instead of the Authorization header.
router.get('/:id/content', validate(fileIdParams, 'params'), fileController.content);

router.use(authenticate);
router.post('/upload', uploadSingle('file'), fileController.upload);
router.get('/', validate(listFilesQuery, 'query'), fileController.list);
router.get('/recent', validate(recentFilesQuery, 'query'), fileController.recent);
router.get('/:id', validate(fileIdParams, 'params'), fileController.getOne);
router.post('/:id/reprocess', validate(fileIdParams, 'params'), fileController.reprocess);
router.delete('/:id', validate(fileIdParams, 'params'), fileController.remove);

module.exports = router;
