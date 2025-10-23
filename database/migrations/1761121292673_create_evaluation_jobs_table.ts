import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'evaluation_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.string('job_id').unique().notNullable() // UUID untuk tracking
      table.string('status', 20).notNullable().defaultTo('queued') // queued, processing, completed, failed
      table.string('job_title').notNullable()

      // Foreign keys ke documents
      table
        .integer('cv_document_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('documents')
        .onDelete('CASCADE')
      table
        .integer('project_document_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('documents')
        .onDelete('CASCADE')

      // CV Evaluation Results
      table.decimal('cv_match_rate', 3, 2).nullable() // 0.00 - 1.00
      table.text('cv_feedback').nullable()

      // Project Evaluation Results
      table.decimal('project_score', 3, 2).nullable() // 1.00 - 5.00
      table.text('project_feedback').nullable()

      // Overall Summary
      table.text('overall_summary').nullable()

      // Error handling
      table.text('error_message').nullable()
      table.integer('retry_count').defaultTo(0)

      table.timestamp('started_at').nullable()
      table.timestamp('completed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
