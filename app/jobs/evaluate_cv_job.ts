import { Job } from '@rlanz/bull-queue'
import { DateTime } from 'luxon'
import EvaluationJob from '#models/evaluation_job'
import llmService from '#services/llm_service'
import vectorService from '#services/vector_service'
import logger from '@adonisjs/core/services/logger'
import queue from '@rlanz/bull-queue/services/main'
import EvaluateProjectJob from './evaluate_project_job.js'

interface EvaluateCvJobPayload {
  evaluationJobId: number
}

export default class EvaluateCvJob extends Job {
  static get $$filepath() {
    return import.meta.url
  }

  /**
   * Evaluate CV berdasarkan job description dan scoring rubric
   */
  async handle(payload: EvaluateCvJobPayload) {
    const { evaluationJobId } = payload
    logger.info(`[EvaluateCvJob] Starting CV evaluation for job ID: ${evaluationJobId}`)

    try {
      // Load evaluation job
      const evaluationJob = await EvaluationJob.query()
        .where('id', evaluationJobId)
        .preload('cvDocument')
        .firstOrFail()

      // Update status
      evaluationJob.status = 'processing'
      evaluationJob.startedAt = DateTime.now()
      await evaluationJob.save()

      const cvDocument = evaluationJob.cvDocument

      // Pastikan CV text sudah di-extract
      if (!cvDocument.extractedText) {
        throw new Error('CV text has not been extracted')
      }

      logger.info(`[EvaluateCvJob] Parsing CV...`)
      // Parse CV untuk structured data
      const parsedCv = await llmService.parseCv(cvDocument.extractedText)

      logger.info(`[EvaluateCvJob] Retrieving relevant context from Job Description...`)
      // Retrieve relevant sections dari Job Description
      const jobDescContext = await vectorService.retrieveRelevant(
        `${evaluationJob.jobTitle}\n${JSON.stringify(parsedCv.skills)}\n${parsedCv.experience.join('\n')}`,
        'job_description',
        3
      )

      logger.info(`[EvaluateCvJob] Retrieving CV Rubric...`)
      // Retrieve CV Scoring Rubric
      const cvRubric = await vectorService.retrieveRelevant(
        'CV evaluation criteria scoring guide technical skills experience achievements cultural fit',
        'cv_rubric',
        5
      )

      logger.info(`[EvaluateCvJob] Generating evaluation...`)
      // Generate evaluation menggunakan LLM
      const evaluationPrompt = `
You are an expert HR evaluator. Evaluate the following CV against the job requirements and scoring rubric.

JOB TITLE: ${evaluationJob.jobTitle}

JOB DESCRIPTION REQUIREMENTS:
${jobDescContext.join('\n\n')}

CV SCORING RUBRIC:
${cvRubric.join('\n\n')}

CANDIDATE CV DATA:
Name: ${parsedCv.name}
Skills: ${parsedCv.skills.join(', ')}
Experience: ${parsedCv.experience.join('\n')}
Education: ${parsedCv.education.join('\n')}
Achievements: ${parsedCv.achievements.join('\n')}

FULL CV TEXT:
${cvDocument.extractedText.substring(0, 3000)}

Provide your evaluation as a JSON object with this structure:
{
  "match_rate": 0.85,  // float between 0.0 and 1.0
  "feedback": "Detailed feedback covering technical skills, experience, achievements, and cultural fit..."
}

Consider:
1. Technical Skills Match (40% weight)
2. Experience Level (25% weight)
3. Relevant Achievements (20% weight)
4. Cultural/Collaboration Fit (15% weight)

Return ONLY valid JSON.
`

      const response = await llmService.generateContent(evaluationPrompt, {
        temperature: 0.5,
        jsonMode: true,
      })

      const evaluation = llmService.parseJsonResponse<{
        match_rate: number
        feedback: string
      }>(response, 'CV Evaluation')

      logger.info(`[EvaluateCvJob] Evaluation complete. Match rate: ${evaluation.match_rate}`)

      // Save hasil evaluation
      evaluationJob.cvMatchRate = Number(evaluation.match_rate)
      evaluationJob.cvFeedback = evaluation.feedback
      await evaluationJob.save()

      logger.info(`[EvaluateCvJob] CV evaluation completed successfully`)

      // Dispatch job berikutnya: Evaluate Project
      logger.info(`[EvaluateCvJob] Dispatching EvaluateProjectJob...`)
      queue.dispatch(EvaluateProjectJob, { evaluationJobId })
    } catch (error) {
      logger.error(`[EvaluateCvJob] Failed:`, error)

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
  async rescue(payload: EvaluateCvJobPayload) {
    const { evaluationJobId } = payload
    logger.error(`[EvaluateCvJob] Job failed after all retries for ID: ${evaluationJobId}`)

    const evaluationJob = await EvaluationJob.find(evaluationJobId)
    if (evaluationJob) {
      evaluationJob.status = 'failed'
      evaluationJob.completedAt = DateTime.now()
      await evaluationJob.save()
    }
  }
}
