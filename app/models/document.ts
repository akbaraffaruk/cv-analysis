import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Document extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: 'cv' | 'project_report'

  @column()
  declare originalName: string

  @column()
  declare filePath: string

  @column()
  declare mimeType: string

  @column()
  declare fileSize: number

  @column()
  declare extractedText: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
