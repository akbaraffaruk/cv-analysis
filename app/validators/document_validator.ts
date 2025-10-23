import vine from '@vinejs/vine'

export const createDocumentValidator = vine.compile(
  vine.object({
    cv: vine.file({
      size: '10mb',
      extnames: ['pdf'],
    }),
    project_report: vine.file({
      size: '10mb',
      extnames: ['pdf'],
    }),
  })
)
