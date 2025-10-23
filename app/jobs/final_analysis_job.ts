import { Job } from '@rlanz/bull-queue'
import { DateTime } from 'luxon'
import EvaluationJob from '#models/evaluation_job'
import llmService from '#services/llm_service'
import logger from '@adonisjs/core/services/logger'

interface FinalAnalysisJobPayload {
  evaluationJobId: number
}

export default class FinalAnalysisJob extends Job {
  static get $$filepath() {
    return import.meta.url
  }

  /**
   * Generate final overall summary dari CV dan Project evaluations
   */
  async handle(payload: FinalAnalysisJobPayload) {
    const { evaluationJobId } = payload
    logger.info(`[FinalAnalysisJob] Starting final analysis for job ID: ${evaluationJobId}`)

    try {
      // Load evaluation job dengan semua data
      const evaluationJob = await EvaluationJob.find(evaluationJobId)

      if (!evaluationJob) {
        throw new Error('Evaluation job not found')
      }

      // Validate bahwa CV dan Project evaluation sudah selesai
      if (!evaluationJob.cvMatchRate || !evaluationJob.projectScore) {
        throw new Error('CV or Project evaluation not completed yet')
      }

      logger.info(`[FinalAnalysisJob] Generating overall summary...`)

      // Generate overall summary
      const summaryPrompt = `
You are an expert hiring manager making a final decision on a candidate.

POSITION: ${evaluationJob.jobTitle}

CV EVALUATION:
- Match Rate: ${evaluationJob.cvMatchRate}/1.0
- Feedback: ${evaluationJob.cvFeedback}

PROJECT EVALUATION:
- Score: ${evaluationJob.projectScore}/5.0
- Feedback: ${evaluationJob.projectFeedback}

Based on the above evaluations, provide a concise overall summary (3-5 sentences) that:
1. Highlights the candidate's key strengths
2. Identifies any gaps or areas for improvement
3. Provides a clear recommendation (Strong Hire / Hire / Maybe / Pass)

Return ONLY a JSON object:
{
  "summary": "Your 3-5 sentence summary here...",
  "recommendation": "Strong Hire" | "Hire" | "Maybe" | "Pass"
}
`

      const response = await llmService.generateContent(summaryPrompt, {
        temperature: 0.6,
        jsonMode: true,
      })

      const finalAnalysis = llmService.parseJsonResponse<{
        summary: string
        recommendation: string
      }>(response, 'Final Analysis')

      logger.info(
        `[FinalAnalysisJob] Final analysis complete. Recommendation: ${finalAnalysis.recommendation}`
      )

      // Save overall summary
      evaluationJob.overallSummary = `${finalAnalysis.summary}\n\nRecommendation: ${finalAnalysis.recommendation}`
      evaluationJob.status = 'completed'
      evaluationJob.completedAt = DateTime.now()
      await evaluationJob.save()

      logger.info(`[FinalAnalysisJob] Evaluation pipeline completed successfully`)
    } catch (error) {
      logger.error(`[FinalAnalysisJob] Failed:`, error)

      // Update status menjadi failed
      const evaluationJob = await EvaluationJob.find(evaluationJobId)
      if (evaluationJob) {
        evaluationJob.status = 'failed'
        evaluationJob.errorMessage = (error as Error).message
        evaluationJob.retryCount += 1
        evaluationJob.completedAt = DateTime.now()
        await evaluationJob.save()
      }

      throw error
    }
  }

  /**
   * Called when job fails after all retries
   */
  async rescue(payload: FinalAnalysisJobPayload) {
    const { evaluationJobId } = payload
    logger.error(`[FinalAnalysisJob] Job failed after all retries for ID: ${evaluationJobId}`)

    const evaluationJob = await EvaluationJob.find(evaluationJobId)
    if (evaluationJob) {
      evaluationJob.status = 'failed'
      evaluationJob.completedAt = DateTime.now()
      await evaluationJob.save()
    }
  }
}
