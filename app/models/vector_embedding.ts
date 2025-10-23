import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class VectorEmbedding extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare documentType: 'job_description' | 'case_study' | 'cv_rubric' | 'project_rubric'

  @column()
  declare documentName: string

  @column()
  declare content: string

  @column({
    prepare: (value: Record<string, unknown>) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare metadata: Record<string, unknown> | null

  @column({
    prepare: (value: number[]) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value),
  })
  declare embedding: number[] | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
