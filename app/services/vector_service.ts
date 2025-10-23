import db from '@adonisjs/lucid/services/db'
import VectorEmbedding from '#models/vector_embedding'
import llmService from '#services/llm_service'
import logger from '@adonisjs/core/services/logger'

export class VectorService {
  /**
   * Ingest dokumen ke vector database
   * Memecah dokumen menjadi chunks dan generate embeddings
   */
  async ingestDocument(
    documentType: 'job_description' | 'case_study' | 'cv_rubric' | 'project_rubric',
    documentName: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    logger.info(`Ingesting document: ${documentName} (${documentType})`)

    // Split content menjadi chunks (simple split by paragraphs)
    const chunks = this.splitIntoChunks(content, 500) // ~500 words per chunk

    logger.info(`Document split into ${chunks.length} chunks`)

    // Generate embeddings dan save ke database
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      logger.info(`Processing chunk ${i + 1}/${chunks.length}`)

      try {
        // Generate embedding
        const embedding = await llmService.generateEmbedding(chunk)

        // Clean chunk content dari null bytes sebelum save
        const cleanedChunk = this.cleanContent(chunk)

        // Save to database
        await VectorEmbedding.create({
          documentType,
          documentName,
          content: cleanedChunk,
          metadata: {
            ...metadata,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
          embedding,
        })

        logger.info(`Chunk ${i + 1}/${chunks.length} saved successfully`)
      } catch (error) {
        logger.error(`Failed to process chunk ${i + 1}/${chunks.length}:`, error)
        throw error
      }
    }

    logger.info(`Document ingestion completed: ${documentName}`)
  }

  /**
   * Retrieve relevant chunks berdasarkan query menggunakan similarity search
   */
  async retrieveRelevant(
    query: string,
    documentType: 'job_description' | 'case_study' | 'cv_rubric' | 'project_rubric',
    topK: number = 5
  ): Promise<string[]> {
    logger.info(`Retrieving relevant chunks for query from ${documentType}`)

    try {
      // Generate embedding untuk query
      const queryEmbedding = await llmService.generateEmbedding(query)

      // Convert embedding array to pgvector format
      const embeddingString = `[${queryEmbedding.join(',')}]`

      // Perform similarity search menggunakan cosine distance
      const results = await db.rawQuery(
        `
        SELECT 
          content,
          metadata,
          1 - (embedding <=> ?::vector) AS similarity
        FROM vector_embeddings
        WHERE document_type = ?
        ORDER BY embedding <=> ?::vector
        LIMIT ?
      `,
        [embeddingString, documentType, embeddingString, topK]
      )

      logger.info(`Found ${results.rows.length} relevant chunks`)

      // Return hanya content dari chunks yang relevan
      return results.rows.map((row: { content: string }) => row.content)
    } catch (error) {
      logger.error('Failed to retrieve relevant chunks:', error)
      throw error
    }
  }

  /**
   * Delete semua embeddings untuk document type tertentu
   * Berguna untuk re-ingestion
   */
  async deleteByDocumentType(
    documentType: 'job_description' | 'case_study' | 'cv_rubric' | 'project_rubric'
  ): Promise<void> {
    logger.info(`Deleting all embeddings for document type: ${documentType}`)

    await VectorEmbedding.query().where('documentType', documentType).delete()

    logger.info(`Deletion completed for document type: ${documentType}`)
  }

  /**
   * Split text menjadi chunks berdasarkan word count
   */
  private splitIntoChunks(text: string, maxWords: number = 500): string[] {
    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0)

    const chunks: string[] = []
    let currentChunk = ''
    let currentWordCount = 0

    for (const paragraph of paragraphs) {
      const paragraphWords = paragraph.trim().split(/\s+/)
      const paragraphWordCount = paragraphWords.length

      // Jika menambahkan paragraph ini akan exceed max words, save current chunk
      if (currentWordCount + paragraphWordCount > maxWords && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = paragraph
        currentWordCount = paragraphWordCount
      } else {
        currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph
        currentWordCount += paragraphWordCount
      }
    }

    // Add the last chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }

  /**
   * Clean content dari null bytes dan control characters
   * PostgreSQL tidak support null bytes dalam TEXT columns
   */
  private cleanContent(text: string): string {
    return text
      .replace(/\u0000/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .trim()
  }

  /**
   * Get statistics tentang embeddings yang tersimpan
   */
  async getStats(): Promise<Record<string, number>> {
    const results = await VectorEmbedding.query()
      .select('documentType')
      .count('* as total')
      .groupBy('documentType')

    const stats: Record<string, number> = {}
    for (const row of results) {
      stats[row.documentType] = Number(row.$extras.total)
    }

    return stats
  }
}

// Export singleton instance
export default new VectorService()
