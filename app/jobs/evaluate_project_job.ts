import { Job } from '@rlanz/bull-queue'
import { DateTime } from 'luxon'
import EvaluationJob from '#models/evaluation_job'
import llmService from '#services/llm_service'
import vectorService from '#services/vector_service'
import logger from '@adonisjs/core/services/logger'
import queue from '@rlanz/bull-queue/services/main'
import FinalAnalysisJob from './final_analysis_job.js'

interface EvaluateProjectJobPayload {
  evaluationJobId: number
}

export default class EvaluateProjectJob extends Job {
  static get $$filepath() {
    return import.meta.url
  }

  /**
   * Evaluate Project Report berdasarkan case study brief dan scoring rubric
   */
  async handle(payload: EvaluateProjectJobPayload) {
    const { evaluationJobId } = payload
    logger.info(`[EvaluateProjectJob] Starting project evaluation for job ID: ${evaluationJobId}`)

    try {
      // Load evaluation job
      const evaluationJob = await EvaluationJob.query()
        .where('id', evaluationJobId)
        .preload('projectDocument')
        .firstOrFail()

      const projectDocument = evaluationJob.projectDocument

      // Pastikan project text sudah di-extract
      if (!projectDocument.extractedText) {
        throw new Error('Project report text has not been extracted')
      }

      logger.info(`[EvaluateProjectJob] Retrieving relevant context from Case Study Brief...`)
      // Retrieve relevant sections dari Case Study Brief
      const caseStudyContext = await vectorService.retrieveRelevant(
        projectDocument.extractedText.substring(0, 1000),
        'case_study',
        5
      )

      logger.info(`[EvaluateProjectJob] Retrieving Project Rubric...`)
      // Retrieve Project Scoring Rubric
      const projectRubric = await vectorService.retrieveRelevant(
        'project evaluation criteria correctness code quality resilience documentation creativity',
        'project_rubric',
        5
      )

      logger.info(`[EvaluateProjectJob] Generating evaluation...`)
      // Generate evaluation menggunakan LLM
      const evaluationPrompt = `
You are an expert technical evaluator. Evaluate the following project report against the case study brief and scoring rubric.

CASE STUDY BRIEF REQUIREMENTS:
${caseStudyContext.join('\n\n')}

PROJECT SCORING RUBRIC:
${projectRubric.join('\n\n')}

PROJECT REPORT:
${projectDocument.extractedText.substring(0, 4000)}

Provide your evaluation as a JSON object with this structure:
{
  "score": 4.2,  // float between 1.0 and 5.0
  "feedback": "Detailed feedback covering correctness, code quality, resilience, documentation, and creativity..."
}

Evaluate based on:
1. Correctness (Prompt & Chaining) - 30% weight
2. Code Quality & Structure - 25% weight
3. Resilience & Error Handling - 20% weight
4. Documentation & Explanation - 15% weight
5. Creativity / Bonus - 10% weight

Return ONLY valid JSON.
`

      const response = await llmService.generateContent(evaluationPrompt, {
        temperature: 0.5,
        jsonMode: true,
      })

      const evaluation = llmService.parseJsonResponse<{
        score: number
        feedback: string
      }>(response, 'Project Evaluation')

      logger.info(`[EvaluateProjectJob] Evaluation complete. Score: ${evaluation.score}`)

      // Save hasil evaluation
      evaluationJob.projectScore = Number(evaluation.score)
      evaluationJob.projectFeedback = evaluation.feedback
      await evaluationJob.save()

      logger.info(`[EvaluateProjectJob] Project evaluation completed successfully`)

      // Dispatch job berikutnya: Final Analysis
      logger.info(`[EvaluateProjectJob] Dispatching FinalAnalysisJob...`)
      queue.dispatch(FinalAnalysisJob, { evaluationJobId })
    } catch (error) {
      logger.error(`[EvaluateProjectJob] Failed:`, error)

      // Update status menjadi failed
      const evaluationJob = await EvaluationJob.find(evaluationJobId)
      if (evaluationJob) {
        evaluationJob.status = 'failed'
        evaluationJob.errorMessage = (error as Error).message
        evaluationJob.retryCount += 1
        await evaluationJob.save()
      }

      throw error
    }
  }

  /**
   * Called when job fails after all retries
   */
  async rescue(payload: EvaluateProjectJobPayload) {
    const { evaluationJobId } = payload
    logger.error(`[EvaluateProjectJob] Job failed after all retries for ID: ${evaluationJobId}`)

    const evaluationJob = await EvaluationJob.find(evaluationJobId)
    if (evaluationJob) {
      evaluationJob.status = 'failed'
      evaluationJob.completedAt = DateTime.now()
      await evaluationJob.save()
    }
  }
}
