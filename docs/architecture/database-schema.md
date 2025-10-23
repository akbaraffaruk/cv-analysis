# Database Schema

Detail schema database untuk CV Analysis API.

---

## Overview

Database menggunakan **PostgreSQL** dengan extension **pgvector** untuk vector similarity search.

**Tables**:
1. `documents` - Uploaded files (CV & Project Reports)
2. `evaluation_jobs` - Evaluation tracking & results
3. `vector_embeddings` - RAG storage untuk system documents

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────┐
│           documents                     │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ type (cv | project_report)              │
│ original_name                           │
│ file_path                               │
│ mime_type                               │
│ file_size                               │
│ extracted_text (TEXT)                   │
│ created_at                              │
│ updated_at                              │
└───────────────┬─────────────────────────┘
                │
                │ 1:N (cv_document_id)
                │
                ▼
┌─────────────────────────────────────────┐
│        evaluation_jobs                  │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ job_id (UUID, UNIQUE)                   │
│ status (queued|processing|completed|    │
│         failed)                         │
│ job_title                               │
│ cv_document_id (FK → documents)         │
│ project_document_id (FK → documents)    │
│ cv_match_rate (DECIMAL)                 │
│ cv_feedback (TEXT)                      │
│ project_score (DECIMAL)                 │
│ project_feedback (TEXT)                 │
│ overall_summary (TEXT)                  │
│ parsed_cv_metadata (JSONB)              │
│ cv_evaluation_metadata (JSONB)          │
│ project_evaluation_metadata (JSONB)     │
│ error_message (TEXT)                    │
│ retry_count (INT)                       │
│ started_at                              │
│ completed_at                            │
│ created_at                              │
│ updated_at                              │
└─────────────────────────────────────────┘
                ▲
                │ 1:N (project_document_id)
                │
┌───────────────┴─────────────────────────┐
│           documents                     │
└─────────────────────────────────────────┘


┌─────────────────────────────────────────┐
│       vector_embeddings                 │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ document_type (job_description |        │
│               case_study |              │
│               cv_rubric |               │
│               project_rubric)           │
│ document_name                           │
│ content (TEXT)                          │
│ metadata (JSONB)                        │
│ embedding (VECTOR(768))                 │
│ created_at                              │
│ updated_at                              │
│                                         │
│ INDEX: ivfflat (embedding)              │
└─────────────────────────────────────────┘
```

---

## Table: `documents`

Store uploaded PDF files dan extracted text.

### Schema

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cv', 'project_report')),
  original_name VARCHAR NOT NULL,
  file_path VARCHAR NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
```

### Columns

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NO | Primary key (auto-increment) |
| `type` | VARCHAR(20) | NO | Document type: `cv` atau `project_report` |
| `original_name` | VARCHAR | NO | Original filename dari upload |
| `file_path` | VARCHAR | NO | Path ke file di storage |
| `mime_type` | VARCHAR(100) | NO | MIME type (biasanya `application/pdf`) |
| `file_size` | INTEGER | NO | File size dalam bytes |
| `extracted_text` | TEXT | YES | Text yang di-extract dari PDF |
| `created_at` | TIMESTAMP | NO | Timestamp upload |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

### Constraints

- `type` harus salah satu dari: `'cv'`, `'project_report'`
- `file_size` harus > 0

### Indexes

- `idx_documents_type` - Query by type
- `idx_documents_created_at` - Sort by creation date

### Example Data

```sql
INSERT INTO documents VALUES
(1, 'cv', 'john-doe-cv.pdf', 'storage/uploads/cv/1730000000000_john-doe-cv.pdf', 
 'application/pdf', 245678, 'JOHN DOE\nBackend Developer\n...', NOW(), NOW());
```

---

## Table: `evaluation_jobs`

Track evaluation jobs, status, dan results.

### Schema

```sql
CREATE TABLE evaluation_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  job_title VARCHAR NOT NULL,
  
  -- Foreign keys
  cv_document_id INTEGER NOT NULL,
  project_document_id INTEGER NOT NULL,
  
  -- Results
  cv_match_rate DECIMAL(3,2),
  cv_feedback TEXT,
  project_score DECIMAL(3,2),
  project_feedback TEXT,
  overall_summary TEXT,
  
  -- Metadata (Full JSON outputs from LLM)
  parsed_cv_metadata JSONB,
  cv_evaluation_metadata JSONB,
  project_evaluation_metadata JSONB,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Foreign key constraints
  CONSTRAINT fk_cv_document 
    FOREIGN KEY (cv_document_id) 
    REFERENCES documents(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_project_document 
    FOREIGN KEY (project_document_id) 
    REFERENCES documents(id) 
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_evaluation_jobs_job_id ON evaluation_jobs(job_id);
CREATE INDEX idx_evaluation_jobs_status ON evaluation_jobs(status);
CREATE INDEX idx_evaluation_jobs_created_at ON evaluation_jobs(created_at DESC);
```

### Columns

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NO | Primary key |
| `job_id` | VARCHAR | NO | UUID untuk tracking (unique) |
| `status` | VARCHAR(20) | NO | Status: `queued`, `processing`, `completed`, `failed` |
| `job_title` | VARCHAR | NO | Job title untuk evaluation context |
| `cv_document_id` | INTEGER | NO | FK ke `documents` (CV) |
| `project_document_id` | INTEGER | NO | FK ke `documents` (Project Report) |
| `cv_match_rate` | DECIMAL(3,2) | YES | CV match rate (0.00 - 1.00) |
| `cv_feedback` | TEXT | YES | CV evaluation feedback dari LLM |
| `project_score` | DECIMAL(3,2) | YES | Project score (1.00 - 5.00) |
| `project_feedback` | TEXT | YES | Project evaluation feedback dari LLM |
| `overall_summary` | TEXT | YES | Overall summary + recommendation |
| `parsed_cv_metadata` | JSONB | YES | Full JSON dari CV parsing |
| `cv_evaluation_metadata` | JSONB | YES | Full JSON dari CV evaluation |
| `project_evaluation_metadata` | JSONB | YES | Full JSON dari project evaluation |
| `error_message` | TEXT | YES | Error message jika failed |
| `retry_count` | INTEGER | NO | Jumlah retry attempts |
| `started_at` | TIMESTAMP | YES | When job processing started |
| `completed_at` | TIMESTAMP | YES | When job completed/failed |
| `created_at` | TIMESTAMP | NO | Job creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

### Constraints

- `job_id` must be unique
- `status` must be one of: `'queued'`, `'processing'`, `'completed'`, `'failed'`
- `cv_match_rate` must be between 0.00 and 1.00
- `project_score` must be between 1.00 and 5.00

### Indexes

- `idx_evaluation_jobs_job_id` - Query by job_id
- `idx_evaluation_jobs_status` - Filter by status
- `idx_evaluation_jobs_created_at` - Sort by date

### Example Data

```sql
INSERT INTO evaluation_jobs VALUES
(1, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'completed', 'Backend Developer', 
 1, 2, 
 0.82, 'Candidate demonstrates strong technical skills...', 
 4.5, 'Excellent implementation...', 
 'Strong candidate with solid foundation...', 
 '{"name": "John Doe", "skills": ["Node.js"]}', 
 '{"technical_skills": 4.5, "experience": 4.0}', 
 '{"correctness": 4.5, "code_quality": 4.0}', 
 NULL, 0, 
 '2024-10-23 14:30:05', '2024-10-23 14:30:28', 
 '2024-10-23 14:30:00', '2024-10-23 14:30:28');
```

### Status Lifecycle

```
queued → processing → completed
                  ↓
                failed (with retry_count)
```

---

## Table: `vector_embeddings`

Store vector embeddings untuk RAG system documents.

### Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE vector_embeddings (
  id SERIAL PRIMARY KEY,
  document_type VARCHAR(50) NOT NULL 
    CHECK (document_type IN ('job_description', 'case_study', 
                              'cv_rubric', 'project_rubric')),
  document_name VARCHAR NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(768),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index untuk fast similarity search
CREATE INDEX ON vector_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX idx_vector_embeddings_doc_type ON vector_embeddings(document_type);
```

### Columns

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NO | Primary key |
| `document_type` | VARCHAR(50) | NO | Type: `job_description`, `case_study`, `cv_rubric`, `project_rubric` |
| `document_name` | VARCHAR | NO | Original document name |
| `content` | TEXT | NO | Text chunk (~ 500 words) |
| `metadata` | JSONB | YES | Metadata: `{page, section, chunk_index}` |
| `embedding` | VECTOR(768) | YES | 768-dimensional vector dari Gemini |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

### Constraints

- `document_type` must be one of: `'job_description'`, `'case_study'`, `'cv_rubric'`, `'project_rubric'`
- `content` cannot be empty

### Indexes

- `ivfflat` index on `embedding` - Fast cosine similarity search
- `idx_vector_embeddings_doc_type` - Filter by document type

### Example Data

```sql
INSERT INTO vector_embeddings VALUES
(1, 'job_description', 'backend-developer-jd.pdf', 
 'We are looking for a Backend Developer with experience in Node.js...', 
 '{"page": 1, "chunk_index": 0}', 
 '[0.123, 0.456, ..., 0.789]', 
 NOW(), NOW());
```

### Similarity Search Query

```sql
-- Find top 5 most similar chunks
SELECT id, document_name, content, 
       (embedding <=> '[query_embedding]') AS distance
FROM vector_embeddings
WHERE document_type = 'job_description'
ORDER BY embedding <=> '[query_embedding]'
LIMIT 5;
```

**Operators**:
- `<->` - Euclidean distance (L2)
- `<=>` - Cosine distance (1 - cosine similarity)
- `<#>` - Inner product

**Note**: Smaller distance = more similar

---

## Database Configuration

### Connection Settings

```typescript
// config/database.ts
{
  client: 'pg',
  connection: {
    connectionString: env.get('DB_URL'),
    ssl: { rejectUnauthorized: false }
  },
  pool: {
    min: 2,
    max: 10
  }
}
```

### Extensions

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

## Migrations

### Run Migrations

```bash
# Run all pending migrations
node ace migration:run

# Rollback last batch
node ace migration:rollback

# Reset database (CAUTION!)
node ace migration:reset
```

### Migration Files

1. `1761121344443_create_enable_pgvector_extensions_table.ts` - Enable pgvector
2. `1761121324455_create_documents_table.ts` - Create documents table
3. `1761121292673_create_evaluation_jobs_table.ts` - Create evaluation_jobs table
4. `1761121303791_create_vector_embeddings_table.ts` - Create vector_embeddings table

---

## Backup & Recovery

### Backup

```bash
# Full backup
pg_dump -h host -U user -d database > backup.sql

# Backup with compression
pg_dump -h host -U user -d database | gzip > backup.sql.gz
```

### Restore

```bash
# Restore from backup
psql -h host -U user -d database < backup.sql

# Restore from compressed backup
gunzip < backup.sql.gz | psql -h host -U user -d database
```

---

## Performance Optimization

### Query Optimization

**Add indexes untuk frequently queried columns**:
```sql
CREATE INDEX idx_evaluation_jobs_status ON evaluation_jobs(status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
```

**Use EXPLAIN untuk analyze queries**:
```sql
EXPLAIN ANALYZE
SELECT * FROM evaluation_jobs WHERE status = 'completed';
```

### Vector Index Tuning

**Adjust IVFFlat lists parameter**:
```sql
-- More lists = better accuracy, slower build
-- Recommended: lists = rows / 1000
CREATE INDEX ON vector_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### Connection Pooling

Configure connection pool di `config/database.ts`:
```typescript
pool: {
  min: 2,        // Minimum connections
  max: 10,       // Maximum connections
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 30000
}
```

---

**Next**: [RAG Pipeline](./rag-pipeline.md) | [LLM Integration](./llm-integration.md)

