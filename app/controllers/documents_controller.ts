import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import pdfParserService from '#services/pdf_parser_service'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import { unlink } from 'node:fs/promises'
import { createDocumentValidator } from '#validators/document_validator'

export default class DocumentsController {
  /**
   * Upload CV atau Project Report
   * POST /upload
   */
  async upload({ request, response }: HttpContext) {
    try {
      const { cv, project_report: projectReport } =
        await request.validateUsing(createDocumentValidator)

      // Create uploads directory if not exists
      const cvPath = app.makePath('storage/uploads/cv')
      const projectReportPath = app.makePath('storage/uploads/project-report')

      // Save CV
      const cvFileName = `${cuid()}.${cv.extname}`
      await cv.move(cvPath, {
        name: cvFileName,
      })

      const cvFilePath = app.makePath('storage/uploads/cv', cvFileName)

      // Extract text dari CV
      const cvText = await pdfParserService.extractText(cvFilePath)

      // Save CV document
      const cvDocument = await Document.create({
        type: 'cv',
        originalName: cv.clientName,
        filePath: cvFilePath,
        mimeType: cv.type || 'application/pdf',
        fileSize: cv.size,
        extractedText: cvText,
      })

      // Save Project Report
      const projectFileName = `${cuid()}.${projectReport.extname}`
      await projectReport.move(projectReportPath, {
        name: projectFileName,
      })

      const projectFilePath = app.makePath('storage/uploads/project-report', projectFileName)

      // Extract text dari Project Report
      const projectText = await pdfParserService.extractText(projectFilePath)

      // Save Project document
      const projectDocument = await Document.create({
        type: 'project_report',
        originalName: projectReport.clientName,
        filePath: projectFilePath,
        mimeType: projectReport.type || 'application/pdf',
        fileSize: projectReport.size,
        extractedText: projectText,
      })

      return response.created({
        message: 'Documents uploaded successfully',
        data: {
          cv: {
            id: cvDocument.id,
            original_name: cvDocument.originalName,
            file_size: cvDocument.fileSize,
          },
          project_report: {
            id: projectDocument.id,
            original_name: projectDocument.originalName,
            file_size: projectDocument.fileSize,
          },
        },
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to upload documents',
        message: (error as Error).message,
      })
    }
  }

  /**
   * Get document by ID
   * GET /documents/:id
   */
  async show({ params, response }: HttpContext) {
    try {
      const document = await Document.findOrFail(params.id)

      return response.ok({
        data: {
          id: document.id,
          type: document.type,
          original_name: document.originalName,
          file_size: document.fileSize,
          created_at: document.createdAt,
        },
      })
    } catch (error) {
      return response.notFound({
        error: 'Document not found',
      })
    }
  }

  /**
   * Delete document
   * DELETE /documents/:id
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const document = await Document.findOrFail(params.id)

      // Delete file dari filesystem
      await unlink(document.filePath)

      // Delete record dari database
      await document.delete()

      return response.ok({
        message: 'Document deleted successfully',
      })
    } catch (error) {
      return response.internalServerError({
        error: 'Failed to delete document',
        message: (error as Error).message,
      })
    }
  }
}
