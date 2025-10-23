# System Architecture

Overview arsitektur CV Analysis API system.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENT                                │
│                    (Postman/Browser/CLI)                      │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                   ADONISJS API SERVER                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              HTTP LAYER                                │  │
│  │  • Routes  • Middleware  • Validators                  │  │
│  └──────────────────────┬─────────────────────────────────┘  │
│                         ▼                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          CONTROLLER LAYER                              │  │
│  │  • DocumentsController                                 │  │
│  │  • EvaluationsController                               │  │
│  └──────────────────────┬─────────────────────────────────┘  │
│                         ▼                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            SERVICE LAYER                               │  │
│  │  • LlmService (Gemini Integration)                     │  │
│  │  • VectorService (RAG Operations)                      │  │
│  │  • PdfParserService (PDF Extraction)                   │  │
│  └─────────┬──────────────────────────────────────────────┘  │
│            │                                                  │
│  ┌─────────▼────────────────────────┐                        │
│  │      MODEL LAYER (Lucid ORM)     │                        │
│  │  • Document                      │                        │
│  │  • EvaluationJob                 │                        │
│  │  • VectorEmbedding               │                        │
│  └──────────────────────────────────┘                        │
└────────────────────────┬─────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│  PostgreSQL  │  │ Bull Queue  │  │  Gemini API  │
│  + pgvector  │  │   (Redis)   │  │              │
│              │  │             │  │ • Generation │
│ • documents  │  │ • CV Eval   │  │ • Embeddings │
│ • eval_jobs  │  │ • Project   │  │              │
│ • embeddings │  │ • Final     │  │              │
└──────────────┘  └──────┬──────┘  └──────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │  Queue Jobs │
                  │             │
                  │ • Evaluate  │
                  │   CvJob     │
                  │ • Evaluate  │
                  │   ProjectJob│
                  │ • Final     │
                  │   Analysis  │
                  └─────────────┘
```

---

## Component Overview

### 1. API Server (AdonisJS)

**Responsibilities**:
- Handle HTTP requests
- Validation
- Authentication (future)
- Response formatting

**Tech Stack**:
- AdonisJS 6
- TypeScript
- Lucid ORM

### 2. Queue System (Bull Queue + Redis)

**Responsibilities**:
- Asynchronous job processing
- Job retry mechanism
- Job status tracking

**Queue Jobs**:
1. **EvaluateCvJob** - Parse & evaluate CV
2. **EvaluateProjectJob** - Evaluate project report
3. **FinalAnalysisJob** - Generate overall summary

**Job Flow**:
```
User triggers /evaluate
  ↓
Create EvaluationJob (status: queued)
  ↓
Dispatch EvaluateCvJob to queue
  ↓
Job 1: EvaluateCvJob
  - Parse CV with LLM
  - RAG: Get job description context
  - RAG: Get CV rubric
  - LLM: Generate cv_match_rate + feedback
  - Update database
  - Dispatch EvaluateProjectJob
  ↓
Job 2: EvaluateProjectJob
  - RAG: Get case study context
  - RAG: Get project rubric
  - LLM: Generate project_score + feedback
  - Update database
  - Dispatch FinalAnalysisJob
  ↓
Job 3: FinalAnalysisJob
  - Combine CV + Project results
  - LLM: Generate overall_summary
  - Update status to "completed"
  ↓
User polls /result/:id
  ↓
Return final evaluation
```

### 3. Database (PostgreSQL + pgvector)

**Responsibilities**:
- Persistent storage
- Vector similarity search
- ACID transactions

**Tables**:
- `documents` - Uploaded PDFs + extracted text
- `evaluation_jobs` - Job tracking + results
- `vector_embeddings` - RAG storage (768-dim vectors)

**Extensions**:
- `pgvector` - Vector operations (cosine similarity)

### 4. LLM Service (Google Gemini)

**Responsibilities**:
- Content generation (CV parsing, evaluations)
- Text embeddings (768 dimensions)
- Structured JSON outputs

**Models Used**:
- `gemini-2.0-flash` - Fast generation
- `text-embedding-004` - 768-dim embeddings

**Rate Limiting**:
- 5 seconds between requests (12 RPM)
- Exponential backoff on errors

### 5. RAG Pipeline (Vector Service)

**Responsibilities**:
- Document ingestion
- Embedding generation
- Similarity search
- Context retrieval

**Flow**:
```
Ingestion:
PDF → Text Extraction → Chunking → Embedding → Storage

Retrieval:
Query → Embedding → Similarity Search → Top-K Chunks → Context
```

---

## Data Flow

### Upload Flow

```
1. Client uploads CV + Project Report (PDF)
   ↓
2. Validator checks file format & size
   ↓
3. PdfParserService extracts text
   ↓
4. Save file to storage/uploads/
   ↓
5. Save metadata to documents table
   ↓
6. Return document IDs
```

### Evaluation Flow

```
1. Client triggers /evaluate with document IDs
   ↓
2. Create EvaluationJob (status: queued)
   ↓
3. Dispatch to Bull Queue
   ↓
4. Return job_id immediately
   ↓
5. [Background] Queue worker picks up job
   ↓
6. EvaluateCvJob:
   - LLM: Parse CV → structured JSON
   - RAG: Retrieve job description (top 3 chunks)
   - RAG: Retrieve CV rubric (top 5 chunks)
   - LLM: Generate cv_match_rate + feedback
   - Save to database
   ↓
7. EvaluateProjectJob:
   - RAG: Retrieve case study (top 5 chunks)
   - RAG: Retrieve project rubric (top 5 chunks)
   - LLM: Generate project_score + feedback
   - Save to database
   ↓
8. FinalAnalysisJob:
   - Combine CV + Project results
   - LLM: Generate overall_summary
   - Update status to "completed"
   ↓
9. Client polls /result/:id
   ↓
10. Return final evaluation
```

### RAG Retrieval Flow

```
1. Generate query text (e.g., job title + skills)
   ↓
2. LlmService.generateEmbedding(query)
   ↓
3. VectorService.similaritySearch(embedding, type, topK)
   ↓
4. PostgreSQL: SELECT ... ORDER BY embedding <=> query_embedding LIMIT K
   ↓
5. Return top-K most similar chunks
   ↓
6. Concatenate chunks as context
   ↓
7. Inject into LLM prompt
```

---

## Scalability Considerations

### Current Architecture

**Single Instance**:
- 1 API server
- 1 Queue worker
- 1 PostgreSQL instance
- 1 Redis instance

**Capacity**:
- ~12 evaluations/minute (rate limiting)
- ~375 evaluations/day (Gemini free tier)

### Future Scaling Options

**Horizontal Scaling**:
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ API Server  │     │ API Server  │     │ API Server  │
│   Instance  │     │   Instance  │     │   Instance  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Load Balancer│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Queue     │    │   Queue     │    │   Queue     │
│  Worker 1   │    │  Worker 2   │    │  Worker 3   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌──────▼──────┐
                   │    Redis    │
                   │   Cluster   │
                   └─────────────┘
```

**Database Scaling**:
- Read replicas for queries
- Write to master
- Connection pooling

**Cache Layer**:
```
┌─────────────┐
│ Redis Cache │
│             │
│ • Parsed CV │
│ • Embeddings│
│ • Results   │
└─────────────┘
```

---

## Security Considerations

### Current Implementation

**File Upload**:
- File type validation (PDF only)
- File size limit (10MB)
- Sanitize filenames

**API**:
- No authentication (MVP)
- CORS enabled
- JSON validation

### Future Security Enhancements

**Authentication & Authorization**:
- JWT tokens
- API keys
- Role-based access control

**Data Protection**:
- Encrypt PDFs at rest
- Encrypt database connections (SSL)
- Sanitize extracted text

**Rate Limiting**:
- Per-IP rate limits
- Per-user quotas
- DDoS protection

---

## Performance Metrics

### Current Performance

**API Response Times**:
- Upload: ~500-800ms (includes PDF parsing)
- Evaluate: ~100-150ms (immediate, queued)
- Result: ~50-80ms (database query)

**Evaluation Processing**:
- CV Evaluation: ~8-10 seconds
- Project Evaluation: ~8-10 seconds
- Final Analysis: ~5-8 seconds
- **Total**: ~25-30 seconds

**Bottlenecks**:
1. Rate limiting (5s delay between requests)
2. LLM API latency (~2-3s per request)
3. Embedding generation during ingestion

### Optimization Strategies

**Caching**:
- Cache parsed CVs (Redis)
- Cache embeddings for common queries
- Cache RAG results

**Batch Processing**:
- Batch embedding generation
- Process multiple evaluations in parallel

**Database Optimization**:
- Index optimization
- Query caching
- Connection pooling

---

## Monitoring & Observability

### Logging

**Structured Logs**:
```typescript
{
  level: 'info',
  timestamp: '2024-10-23T14:30:00.000Z',
  context: 'EvaluateCvJob',
  job_id: 'a1b2c3d4...',
  message: 'CV evaluation completed',
  duration: 8543,
  metadata: { cv_match_rate: 0.82 }
}
```

**Log Levels**:
- ERROR: Failures, exceptions
- WARN: Retries, degraded performance
- INFO: Job lifecycle, API calls
- DEBUG: Detailed execution flow

### Metrics to Track

**API Metrics**:
- Request count
- Response times (p50, p95, p99)
- Error rates
- Concurrent users

**Queue Metrics**:
- Job processing time
- Queue depth
- Failed jobs count
- Retry count

**LLM Metrics**:
- API call count
- Token usage
- Rate limit hits
- Error rates

**Database Metrics**:
- Query execution time
- Connection pool usage
- Deadlocks

### Health Checks

**Endpoints**:
```
GET /health
GET /health/database
GET /health/redis
GET /health/queue
```

---

## Disaster Recovery

### Backup Strategy

**Database Backups**:
- Daily full backup
- Hourly incremental backup
- 30-day retention

**File Storage**:
- S3/object storage backup
- Versioning enabled

### Failure Scenarios

**Scenario 1: Database Failure**
- Switch to read replica
- Restore from backup
- **RTO**: 5 minutes
- **RPO**: 1 hour

**Scenario 2: Redis Failure**
- Jobs remain in queue
- Restart Redis
- Resume processing
- **RTO**: 1 minute

**Scenario 3: LLM API Outage**
- Automatic retries (3 attempts)
- Exponential backoff
- Mark job as failed after max attempts
- Manual retry via admin panel

---

**Next**: [Database Schema](./database-schema.md) | [RAG Pipeline](./rag-pipeline.md)

