import vine from '@vinejs/vine'

export const createEvaluationValidator = vine.compile(
  vine.object({
    job_title: vine.string(),
    cv_document_id: vine.number().exists({
      table: 'documents',
      column: 'id',
    }),
    project_document_id: vine.number().exists({
      table: 'documents',
      column: 'id',
    }),
  })
)
