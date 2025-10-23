/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
const DocumentsController = () => import('#controllers/documents_controller')
const EvaluationsController = () => import('#controllers/evaluations_controller')

// Health check
router.get('/', async () => {
  return {
    message: 'CV Analysis API',
    version: '1.0.0',
    status: 'running',
  }
})

// Document routes
router.post('/upload', [DocumentsController, 'upload'])
router.get('/documents/:id', [DocumentsController, 'show'])
router.delete('/documents/:id', [DocumentsController, 'destroy'])

// Evaluation routes
router.post('/evaluate', [EvaluationsController, 'evaluate'])
router.get('/result/:id', [EvaluationsController, 'result'])
router.get('/evaluations', [EvaluationsController, 'index'])
