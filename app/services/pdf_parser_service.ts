import { readFile } from 'node:fs/promises'
import logger from '@adonisjs/core/services/logger'
import { PDFParse } from 'pdf-parse'

export class PdfParserService {
  /**
   * Extract text dari PDF file
   */
  async extractText(filePath: string): Promise<string> {
    try {
      logger.info(`Extracting text from PDF: ${filePath}`)

      // Read file sebagai buffer
      const buffer = await readFile(filePath)

      // Convert Buffer ke Uint8Array karena pdf-parse membutuhkan Uint8Array
      const uint8Array = new Uint8Array(buffer)

      // Parse PDF
      const parser = new PDFParse(uint8Array)
      const data = await parser.getText()

      if (!data.text || data.text.trim().length === 0) {
        throw new Error('No text found in PDF file')
      }

      logger.info(`Successfully extracted ${data.text.length} characters from PDF`)

      // Clean up text
      const cleanedText = this.cleanText(data.text)

      return cleanedText
    } catch (error) {
      logger.error(`Failed to extract text from PDF: ${error}`)
      throw new Error(`PDF parsing failed: ${(error as Error).message}`)
    }
  }

  /**
   * Clean dan normalize text hasil extraction
   */
  private cleanText(text: string): string {
    return (
      text
        // Remove null bytes (0x00) - PostgreSQL tidak support null bytes dalam TEXT
        .replace(/\u0000/g, '')
        // Remove other problematic control characters
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Remove multiple spaces
        .replace(/\s+/g, ' ')
        // Remove multiple newlines (keep max 2 for paragraph separation)
        .replace(/\n{3,}/g, '\n\n')
        // Trim whitespace
        .trim()
    )
  }

  /**
   * Extract metadata dari PDF
   */
  async extractMetadata(filePath: string): Promise<{
    numPages: number
    info: Record<string, unknown>
  }> {
    try {
      const buffer = await readFile(filePath)
      const uint8Array = new Uint8Array(buffer)
      const parser = new PDFParse(uint8Array)
      const data = await parser.getInfo({ parsePageInfo: true })

      return {
        numPages: data.pages.length,
        info: data.info || {},
      }
    } catch (error) {
      logger.error(`Failed to extract PDF metadata: ${error}`)
      throw new Error(`PDF metadata extraction failed: ${(error as Error).message}`)
    }
  }
}

// Export singleton instance
export default new PdfParserService()
