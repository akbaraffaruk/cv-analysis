import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import vectorService from '#services/vector_service'
import pdfParserService from '#services/pdf_parser_service'
import app from '@adonisjs/core/services/app'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

export default class IngestDocuments extends BaseCommand {
  static commandName = 'ingest:documents'
  static description =
    'Ingest system documents (job descriptions, case study, rubrics) into vector database'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({
    description: 'Clear existing embeddings before ingesting',
  })
  declare clear: boolean

  async run() {
    const systemDocsPath = app.makePath('storage/system-documents')

    this.logger.info('Starting document ingestion...')

    try {
      // Clear existing embeddings jika flag --clear
      if (this.clear) {
        this.logger.warning('Clearing existing embeddings...')
        await vectorService.deleteByDocumentType('job_description')
        await vectorService.deleteByDocumentType('case_study')
        await vectorService.deleteByDocumentType('cv_rubric')
        await vectorService.deleteByDocumentType('project_rubric')
        this.logger.success('Existing embeddings cleared')
      }

      // Ingest Job Descriptions
      await this.ingestFolder(
        join(systemDocsPath, 'job-descriptions'),
        'job_description',
        'Job Descriptions'
      )

      // Ingest Case Study
      await this.ingestFolder(join(systemDocsPath, 'case-study'), 'case_study', 'Case Study')

      // Ingest Rubrics
      await this.ingestFolder(join(systemDocsPath, 'rubrics'), 'cv_rubric', 'CV Rubrics', 'cv')
      await this.ingestFolder(
        join(systemDocsPath, 'rubrics'),
        'project_rubric',
        'Project Rubrics',
        'project'
      )

      // Show stats
      this.logger.info('\nIngestion completed! Current statistics:')
      const stats = await vectorService.getStats()
      for (const [type, count] of Object.entries(stats)) {
        this.logger.info(`  ${type}: ${count} chunks`)
      }

      this.logger.success('✓ All documents ingested successfully')
    } catch (error) {
      this.logger.error('Ingestion failed:')
      this.logger.error((error as Error).message)
      this.exitCode = 1
    }
  }

  /**
   * Ingest semua files dalam folder
   */
  private async ingestFolder(
    folderPath: string,
    documentType: 'job_description' | 'case_study' | 'cv_rubric' | 'project_rubric',
    label: string,
    fileFilter?: string
  ) {
    this.logger.info(`\nIngesting ${label}...`)

    try {
      const files = await readdir(folderPath)
      const pdfFiles = files.filter((f) => {
        if (!f.endsWith('.pdf')) return false
        if (fileFilter) return f.toLowerCase().includes(fileFilter)
        return true
      })

      if (pdfFiles.length === 0) {
        this.logger.warning(`  No PDF files found in ${folderPath}`)
        return
      }

      for (const file of pdfFiles) {
        const filePath = join(folderPath, file)
        this.logger.info(`  Processing: ${file}`)

        try {
          // Extract text dari PDF
          const text = await pdfParserService.extractText(filePath)

          // Ingest ke vector database
          await vectorService.ingestDocument(documentType, file, text, {
            source: label,
            filename: file,
          })

          this.logger.success(`  ✓ ${file} ingested`)
        } catch (error) {
          this.logger.error(`  ✗ Failed to ingest ${file}: ${(error as Error).message}`)
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.warning(`  Folder not found: ${folderPath}`)
      } else {
        throw error
      }
    }
  }
}
