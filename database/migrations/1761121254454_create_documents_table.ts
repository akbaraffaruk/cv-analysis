import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.string('type', 20).notNullable() // 'cv' or 'project_report'
      table.string('original_name').notNullable()
      table.string('file_path').notNullable()
      table.string('mime_type', 100).notNullable()
      table.integer('file_size').notNullable()
      table.text('extracted_text').nullable() // Teks hasil parsing PDF

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
