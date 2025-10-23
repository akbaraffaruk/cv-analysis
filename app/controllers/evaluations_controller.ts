import type { HttpContext } from '@adonisjs/core/http'
import EvaluationJob from '#models/evaluation_job'
import Document from '#models/document'
import queue from '@rlanz/bull-queue/services/main'
import { randomUUID } from 'node:crypto'
import EvaluateCvJob from '../jobs/evaluate_cv_job.js'
import { createEvaluationValidator } from '#validators/evaluation_validator'

export default class EvaluationsController {
  /**
   * Trigger evaluation pipeline
   * POST /evaluate
   */
  async evaluate({ request, response }: HttpContext) {
    try {
      const {
        job_title: jobTitle,
        cv_document_id: cvDocumentId,
        project_document_id: projectDocumentId,
      } = await request.validateUsing(createEvaluationValidator)

      // Validate documents exist
      const cvDoc = await Document.find(cvDocumentId)
      const projectDoc = await Document.find(projectDocumentId)

      if (!cvDoc || !projectDoc) {
        return response.notFound({
          error: 'One or both documents not found',
        })
      }

      // Validate document types
      if (cvDoc.type !== 'cv' || projectDoc.type !== 'project_report') {
        return response.badRequest({
          error: 'Invalid document types',
          message: 'cv_document_id must be a CV and project_document_id must be a project report',
        })
      }

      // Create evaluation job
      const jobId = randomUUID()
      const evaluationJob = await EvaluationJob.create({
        jobId,
        status: 'queued',
        jobTitle,
        cvDocumentId,
        projectDocumentId,
        retryCount: 0,
      })

      // Dispatch ke queue
      queue.dispatch(EvaluateCvJob, { evaluationJobId: evaluationJob.id })

      return response.created({
        id: jobId,
        status: 'queued',
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to create evaluation job',
        message: (error as Error).message,
      })
    }
  }

  /**
   * Get evaluation result
   * GET /result/:id
   */
  async result({ params, response }: HttpContext) {
    try {
      const { id } = params

      // Find evaluation job by jobId (UUID)
      const evaluationJob = await EvaluationJob.query().where('jobId', id).first()

      if (!evaluationJob) {
        return response.notFound({
          error: 'Evaluation job not found',
        })
      }

      // Response based on status
      if (evaluationJob.status === 'queued' || evaluationJob.status === 'processing') {
        return response.ok({
          id: evaluationJob.jobId,
          status: evaluationJob.status,
        })
      }

      // Jika failed
      if (evaluationJob.status === 'failed') {
        return response.ok({
          id: evaluationJob.jobId,
          status: 'failed',
          error: evaluationJob.errorMessage,
        })
      }

      // Jika completed
      return response.ok({
        id: evaluationJob.jobId,
        status: 'completed',
        result: {
          cv_match_rate: evaluationJob.cvMatchRate,
          cv_feedback: evaluationJob.cvFeedback,
          project_score: evaluationJob.projectScore,
          project_feedback: evaluationJob.projectFeedback,
        },
        overall_summary: evaluationJob.overallSummary,
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to fetch evaluation result',
        message: (error as Error).message,
      })
    }
  }

  /**
   * Get all evaluation jobs (bonus endpoint)
   * GET /evaluations
   */
  async index({ response }: HttpContext) {
    try {
      const evaluations = await EvaluationJob.query().orderBy('createdAt', 'desc').limit(50)

      return response.ok({
        data: evaluations.map((job) => ({
          id: job.jobId,
          status: job.status,
          job_title: job.jobTitle,
          created_at: job.createdAt,
          completed_at: job.completedAt,
        })),
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to fetch evaluations',
        message: (error as Error).message,
      })
    }
  }
}
