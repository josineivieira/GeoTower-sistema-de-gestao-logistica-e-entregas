const express = require('express');
const router = express.Router();
const ycompanyController = require('../controllers/ycompanyController');

// Todos os endpoints estão disponíveis (sem autenticação obrigatória por enquanto)
// TODO: Adicionar autenticação quando necessário

// CRUD básico
router.get('/', ycompanyController.getAll);
router.get('/search', ycompanyController.search);
router.get('/stats', ycompanyController.stats);
router.get('/export', ycompanyController.export);
router.get('/:id', ycompanyController.getById);
router.post('/', ycompanyController.create);
router.put('/:id', ycompanyController.update);
router.delete('/:id', ycompanyController.delete);

// Operações em massa
router.post('/bulk/import', ycompanyController.bulkImport);

module.exports = router;
