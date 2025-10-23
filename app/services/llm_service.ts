import { GoogleGenAI } from '@google/genai'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

interface GenerateOptions {
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

export class LlmService {
  private client: GoogleGenAI
  private model: string
  private lastRequestTime: number = 0
  private minRequestInterval: number = 5000 // 5 detik antara request (12 RPM max)

  constructor() {
    this.client = new GoogleGenAI({
      apiKey: env.get('GEMINI_API_KEY'),
    })
    this.model = env.get('GEMINI_MODEL', 'gemini-2.0-flash-exp')
  }

  /**
   * Rate limiting - tunggu minimal interval antara requests
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest
      logger.info(`Rate limiting: waiting ${waitTime}ms before next request`)
      await this.sleep(waitTime)
    }

    this.lastRequestTime = Date.now()
  }

  /**
   * Generate content dari Gemini dengan retry mechanism
   */
  async generateContent(prompt: string, options: GenerateOptions = {}): Promise<string> {
    // Rate limiting sebelum request
    await this.rateLimit()

    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`LLM request attempt ${attempt}/${maxRetries}`)

        const response = await this.client.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 2048,
            responseMimeType: options.jsonMode ? 'application/json' : 'text/plain',
          },
        })

        if (!response.text) {
          throw new Error('Empty response from Gemini API')
        }

        logger.info('LLM request successful')
        logger.info('Response preview:', response.text.substring(0, 150))
        return response.text
      } catch (error) {
        lastError = error as Error
        const errorStr = JSON.stringify(error)
        logger.error(`LLM request failed (attempt ${attempt}/${maxRetries}):`, errorStr)

        // Check if error is 503 (overloaded)
        const is503 = errorStr.includes('503') || errorStr.includes('overloaded')

        // Jika ini bukan attempt terakhir, tunggu sebelum retry
        if (attempt < maxRetries) {
          // Jika 503, tunggu lebih lama (30 detik, 60 detik, 120 detik)
          const baseDelay = is503 ? 30000 : 3000
          const backoffDelay = baseDelay * Math.pow(2, attempt - 1)
          logger.info(`Retrying in ${backoffDelay}ms...`)
          await this.sleep(backoffDelay)
        }
      }
    }

    throw new Error(
      `Failed to generate content after ${maxRetries} attempts: ${JSON.stringify(lastError)}`
    )
  }

  /**
   * Generate embeddings untuk text (untuk RAG)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Rate limiting
    await this.rateLimit()

    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Embedding generation attempt ${attempt}/${maxRetries}`)

        const response = await this.client.models.embedContent({
          model: 'gemini-embedding-001',
          contents: text,
          config: {
            outputDimensionality: 768,
          },
        })

        if (!response.embeddings || response.embeddings.length === 0) {
          throw new Error('Empty embedding response from Gemini API')
        }

        const values = response.embeddings[0].values
        if (!values) {
          throw new Error('No values in embedding response')
        }

        logger.info('Embedding generation successful')
        return values
      } catch (error) {
        lastError = error as Error
        logger.error(
          `Embedding generation failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`
        )

        if (attempt < maxRetries) {
          const backoffDelay = 3000 * Math.pow(2, attempt - 1)
          await this.sleep(backoffDelay)
        }
      }
    }

    throw new Error(
      `Failed to generate embedding after ${maxRetries} attempts: ${lastError?.message}`
    )
  }

  /**
   * Parse CV menggunakan Gemini
   */
  async parseCv(cvText: string): Promise<{
    name: string
    skills: string[]
    experience: string[]
    education: string[]
    achievements: string[]
  }> {
    const prompt = `
You are a CV parser. Extract structured information from the following CV text.

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "name": "candidate full name",
  "skills": ["skill1", "skill2"],
  "experience": ["experience1", "experience2"],
  "education": ["education1", "education2"],
  "achievements": ["achievement1", "achievement2"]
}

CV Text:
${cvText.substring(0, 4000)}
`

    const response = await this.generateContent(prompt, {
      temperature: 0.3,
      jsonMode: true,
    })

    const parsed = this.parseJsonResponse<{
      name: string
      skills: string[]
      experience: string[]
      education: string[]
      achievements: string[]
    }>(response, 'CV Parsing')

    // Validate structure
    if (!parsed.name || !Array.isArray(parsed.skills)) {
      throw new Error('Invalid CV structure returned')
    }

    return parsed
  }

  /**
   * Clean JSON response - remove markdown code blocks
   */
  cleanJsonResponse(response: string): string {
    let cleaned = response.trim()

    // Remove ```json and ``` markers
    cleaned = cleaned.replace(/^```json\s*/i, '')
    cleaned = cleaned.replace(/^```\s*/i, '')
    cleaned = cleaned.replace(/\s*```$/i, '')
    cleaned = cleaned.trim()

    return cleaned
  }

  /**
   * Parse JSON response dengan error handling
   */
  parseJsonResponse<T>(response: string, context: string): T {
    try {
      const cleaned = this.cleanJsonResponse(response)
      logger.info(`[${context}] Cleaned response (first 200 chars):`, cleaned.substring(0, 200))
      return JSON.parse(cleaned) as T
    } catch (error) {
      logger.error(`[${context}] Failed to parse JSON:`, error)
      logger.error(`[${context}] Raw response:`, response.substring(0, 500))
      throw new Error(`Invalid JSON response from LLM in ${context}`)
    }
  }

  /**
   * Helper untuk sleep/delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export default new LlmService()
