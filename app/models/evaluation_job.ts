import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Document from '#models/document'

export default class EvaluationJob extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare jobId: string

  @column()
  declare status: 'queued' | 'processing' | 'completed' | 'failed'

  @column()
  declare jobTitle: string

  @column()
  declare cvDocumentId: number

  @column()
  declare projectDocumentId: number

  @column()
  declare cvMatchRate: number | null

  @column()
  declare cvFeedback: string | null

  @column()
  declare projectScore: number | null

  @column()
  declare projectFeedback: string | null

  @column()
  declare overallSummary: string | null

  @column()
  declare errorMessage: string | null

  @column()
  declare retryCount: number

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Document, {
    foreignKey: 'cvDocumentId',
  })
  declare cvDocument: BelongsTo<typeof Document>

  @belongsTo(() => Document, {
    foreignKey: 'projectDocumentId',
  })
  declare projectDocument: BelongsTo<typeof Document>
}
