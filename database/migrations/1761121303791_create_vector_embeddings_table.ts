import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vector_embeddings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      table.string('document_type', 50).notNullable() // 'job_description', 'case_study', 'cv_rubric', 'project_rubric'
      table.string('document_name').notNullable()
      table.text('content').notNullable() // Chunk dari dokumen
      table.jsonb('metadata').nullable() // JSON metadata (halaman, section, dll)

      // Vector embedding (768 dimensions untuk Gemini gemini-embedding-001)
      // atau bisa 1536 untuk models lain
      table.specificType('embedding', 'vector(768)').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })

    // Create index untuk similarity search (cosine distance)
    this.schema.raw(`
      CREATE INDEX ON vector_embeddings 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
