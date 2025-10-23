# CV Analysis API

Backend service untuk automated CV dan Project Report evaluation menggunakan AI (Google Gemini) dan RAG (Retrieval Augmented Generation) dengan PostgreSQL pgvector.

## 🎯 Case Study Overview

Sistem ini mengotomasi proses screening kandidat dengan:

1. **Upload** CV dan Project Report (PDF)
2. **Evaluate** menggunakan AI dengan RAG untuk context retrieval
3. **Generate** structured evaluation report dengan scoring

### Deliverables yang Diimplementasi

✅ **Backend Service** - RESTful API dengan 3 endpoint utama  
✅ **Evaluation Pipeline** - AI-driven pipeline dengan RAG, LLM chaining, error handling  
✅ **Standardized Scoring** - CV Match Rate (0.0-1.0) dan Project Score (1.0-5.0)

## 🚀 Features

- ✅ **Upload CV & Project Report** (PDF format)
- ✅ **Automated Evaluation Pipeline** menggunakan Queue Jobs
- ✅ **RAG-based Context Retrieval** dengan pgvector
- ✅ **LLM Chaining** (CV Eval → Project Eval → Final Analysis)
- ✅ **Error Handling & Retry Mechanism** dengan exponential backoff
- ✅ **Rate Limiting** untuk manage Gemini API quota
- ✅ **Asynchronous Job Processing** dengan Bull Queue
- ✅ **Structured Evaluation Results** dengan detailed feedback

## 🏗️ Tech Stack

- **Framework**: AdonisJS 6
- **Database**: PostgreSQL (Neon) dengan pgvector extension
- **Queue**: Bull Queue (Redis)
- **LLM**: Google Gemini 2.0 Flash
- **Language**: TypeScript
- **PDF Parser**: pdf-parse
- **Embedding**: Gemini text-embedding-004 (768 dimensions)

## 📋 Prerequisites

- Node.js v18+
- PostgreSQL database dengan pgvector extension (Neon recommended)
- Redis server untuk queue
- Google Gemini API Key ([Get it here](https://aistudio.google.com/apikey))

## ⚙️ Installation & Setup

### 1. Clone Repository & Install Dependencies

```bash
git clone <repository-url>
cd cv-analysis
pnpm install
```

### 2. Environment Variables

Copy `.env.example` ke `.env` dan isi:

```env
# Server
PORT=3333
HOST=localhost
NODE_ENV=development
APP_KEY=<generate-random-key>

# Database (Neon PostgreSQL dengan pgvector)
DB_URL=postgresql://user:password@host/database?sslmode=require

# Queue (Redis)
QUEUE_REDIS_HOST=127.0.0.1
QUEUE_REDIS_PORT=6379
QUEUE_REDIS_PASSWORD=

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
```

**Generate APP_KEY**:

```bash
node ace generate:key
```

### 3. Run Migrations

```bash
node ace migration:run
```

Ini akan membuat tables:

- `documents` - Store uploaded CV & Project Report dengan extracted text
- `evaluation_jobs` - Track evaluation jobs & results
- `vector_embeddings` - RAG storage dengan pgvector (768 dimensions)

### 4. Prepare System Documents

Sistem membutuhkan 4 jenis dokumen internal untuk RAG:

#### a) Job Descriptions

Letakkan 1-5 file PDF job descriptions di:

```
storage/system-documents/job-descriptions/
├── backend-developer-jd.pdf
├── senior-backend-jd.pdf
└── ...
```

**Tujuan**: Sebagai ground truth untuk mengevaluasi CV kandidat.

#### b) Case Study Brief

Letakkan case study brief (dokumen ini) di:

```
storage/system-documents/case-study/
└── case-study-brief.pdf
```

**Tujuan**: Sebagai ground truth untuk mengevaluasi Project Report kandidat.

#### c) CV Scoring Rubric

Letakkan rubric untuk scoring CV di:

```
storage/system-documents/rubrics/
└── cv-rubric.pdf  (atau nama dengan 'cv')
```

**Isi**:

- Technical Skills Match (40%)
- Experience Level (25%)
- Relevant Achievements (20%)
- Cultural Fit (15%)

#### d) Project Scoring Rubric

Letakkan rubric untuk scoring project di:

```
storage/system-documents/rubrics/
└── project-rubric.pdf  (atau nama dengan 'project')
```

**Isi**:

- Correctness (30%)
- Code Quality (25%)
- Resilience & Error Handling (20%)
- Documentation (15%)
- Creativity/Bonus (10%)

### 5. Ingest System Documents ke Vector Database

```bash
node ace ingest:documents --clear
```

**Apa yang terjadi**:

1. Read semua PDF dari folders di atas
2. Extract text dari setiap PDF
3. Split menjadi chunks (~500 words)
4. Generate embeddings menggunakan Gemini
5. Store ke PostgreSQL dengan pgvector

**Expected Output**:

```
Starting document ingestion...

Ingesting Job Descriptions...
  Processing: backend-developer-jd.pdf
  ✓ backend-developer-jd.pdf ingested

Ingesting Case Study...
  Processing: case-study-brief.pdf
  ✓ case-study-brief.pdf ingested

Ingesting CV Rubrics...
  Processing: cv-rubric.pdf
  ✓ cv-rubric.pdf ingested

Ingesting Project Rubrics...
  Processing: project-rubric.pdf
  ✓ project-rubric.pdf ingested

Ingestion completed! Current statistics:
  job_description: 15 chunks
  case_study: 8 chunks
  cv_rubric: 5 chunks
  project_rubric: 6 chunks
✓ All documents ingested successfully
```

### 6. Start Services

Buka 2 terminal:

**Terminal 1 - Queue Worker**:

```bash
node ace queue:listen
```

**Terminal 2 - API Server**:

```bash
pnpm dev
```

API akan berjalan di `http://localhost:3333`

## 📡 API Usage Guide

### Complete Workflow

#### Step 1: Upload CV dan Project Report

**Endpoint**: `POST /upload`

**Request** (multipart/form-data):

```bash
curl -X POST http://localhost:3333/upload \
  -F "cv=@path/to/john-doe-cv.pdf" \
  -F "project_report=@path/to/john-doe-project-report.pdf"
```

**Response**:

```json
{
  "message": "Documents uploaded successfully",
  "data": {
    "cv": {
      "id": 1,
      "original_name": "john-doe-cv.pdf",
      "file_size": 245678
    },
    "project_report": {
      "id": 2,
      "original_name": "john-doe-project-report.pdf",
      "file_size": 512345
    }
  }
}
```

**Apa yang terjadi**:

1. PDF files di-upload ke `storage/uploads/cv/` dan `storage/uploads/project-report/`
2. Text di-extract dari PDF menggunakan pdf-parse
3. Metadata disimpan ke database table `documents`
4. Return document IDs untuk step berikutnya

---

#### Step 2: Trigger Evaluation

**Endpoint**: `POST /evaluate`

**Request** (JSON):

```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Backend Developer",
    "cv_document_id": 1,
    "project_document_id": 2
  }'
```

**Response**:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued"
}
```

**Apa yang terjadi**:

1. Create evaluation job di database dengan status "queued"
2. Dispatch job ke Redis queue
3. Return job ID untuk tracking
4. Response immediate (tidak wait sampai selesai)

**Pipeline yang berjalan di background**:

```
🔄 EvaluateCvJob (5-10 detik)
   ├─ Parse CV menggunakan Gemini
   ├─ RAG: Retrieve Job Description context (top 3 chunks)
   ├─ RAG: Retrieve CV Rubric (top 5 chunks)
   ├─ LLM: Generate cv_match_rate & cv_feedback
   └─ Save to database → trigger next job

🔄 EvaluateProjectJob (5-10 detik)
   ├─ RAG: Retrieve Case Study context (top 5 chunks)
   ├─ RAG: Retrieve Project Rubric (top 5 chunks)
   ├─ LLM: Generate project_score & project_feedback
   └─ Save to database → trigger next job

🔄 FinalAnalysisJob (5-10 detik)
   ├─ Combine CV & Project evaluations
   ├─ LLM: Generate overall_summary
   └─ Update status to "completed"

Total time: ~20-30 seconds (dengan rate limiting)
```

---

#### Step 3: Check Evaluation Status & Result

**Endpoint**: `GET /result/:id`

**Request**:

```bash
curl http://localhost:3333/result/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response (while processing)**:

```json
{
  "id": "a1b2c3d4-...",
  "status": "processing"
}
```

**Response (when completed)**:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "result": {
    "cv_match_rate": 0.82,
    "cv_feedback": "Candidate demonstrates strong technical skills with 5+ years of backend development experience using Node.js, Python, and PostgreSQL. Good exposure to cloud platforms (AWS) and API design. Experience level aligns well with senior positions. Achievements show measurable impact in previous roles with performance optimization and system scaling. Communication skills evident from leadership roles mentioned. Overall strong match for Backend Developer position.",
    "project_score": 4.5,
    "project_feedback": "Excellent implementation of the requirements. Code demonstrates proper LLM chaining with clear separation of concerns. RAG implementation using pgvector shows thoughtful design choices. Strong error handling with retry mechanisms and exponential backoff. Rate limiting implemented to manage API quotas effectively. Documentation is clear and comprehensive. Minor areas for improvement: could add unit tests for critical services and consider caching for parsed CV results. Overall, high-quality deliverable that meets and exceeds expectations."
  },
  "overall_summary": "Strong candidate with solid technical foundation and proven ability to deliver complex AI-integrated systems. The CV shows extensive backend experience that aligns well with job requirements. The project deliverable demonstrates excellent understanding of LLM workflows, RAG implementation, and production-ready error handling. Candidate shows attention to detail in both code quality and documentation. Recommended for hire.\n\nRecommendation: Hire"
}
```

**Scoring Explanation**:

**CV Match Rate** (0.0 - 1.0):

- Weighted average dari 4 parameters
- 0.82 = 82% match dengan job requirements
- Breakdown:
  - Technical Skills Match (40% weight) → scored based on alignment
  - Experience Level (25% weight) → scored 1-5 based on years
  - Relevant Achievements (20% weight) → scored based on impact
  - Cultural Fit (15% weight) → scored based on demonstrated soft skills

**Project Score** (1.0 - 5.0):

- Weighted average dari 5 parameters
- 4.5/5.0 = Excellent
- Breakdown:
  - Correctness (30% weight) → prompt design, LLM chaining, RAG
  - Code Quality (25% weight) → clean, modular, testable
  - Resilience (20% weight) → error handling, retries
  - Documentation (15% weight) → README, explanations
  - Creativity (10% weight) → bonus features

---

#### Step 4: List All Evaluations (Bonus)

**Endpoint**: `GET /evaluations`

```bash
curl http://localhost:3333/evaluations
```

**Response**:

```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "status": "completed",
      "job_title": "Backend Developer",
      "created_at": "2024-10-23T14:30:00.000Z",
      "completed_at": "2024-10-23T14:30:25.000Z"
    },
    {
      "id": "b2c3d4e5-...",
      "status": "processing",
      "job_title": "Senior Backend Developer",
      "created_at": "2024-10-23T14:35:00.000Z",
      "completed_at": null
    }
  ]
}
```

## 🎯 Evaluation Pipeline Architecture

### RAG (Retrieval Augmented Generation)

**Ingestion Flow**:

```
PDF Document
  → Extract Text (pdf-parse)
  → Split into Chunks (~500 words)
  → Generate Embeddings (Gemini text-embedding-004)
  → Store in PostgreSQL (pgvector with cosine similarity index)
```

**Retrieval Flow**:

```
Query Text
  → Generate Query Embedding
  → Cosine Similarity Search in pgvector
  → Return Top-K most relevant chunks
  → Inject into LLM prompt
```

### LLM Chaining

**Chain 1: CV Evaluation**

```
Input: CV Text + Job Description (RAG) + CV Rubric (RAG)
LLM: Parse CV → Generate match_rate & feedback
Output: cv_match_rate (0.0-1.0), cv_feedback (string)
```

**Chain 2: Project Evaluation**

```
Input: Project Report + Case Study (RAG) + Project Rubric (RAG)
LLM: Analyze project → Generate score & feedback
Output: project_score (1.0-5.0), project_feedback (string)
```

**Chain 3: Final Analysis**

```
Input: CV evaluation + Project evaluation
LLM: Synthesize → Generate overall summary
Output: overall_summary (string with recommendation)
```

### Error Handling & Resilience

**Rate Limiting**:

- 5 seconds minimum between requests (12 RPM, safe under 15 RPM limit)
- Automatic delay before each LLM call

**Retry Strategy**:

- Max 3 attempts per request
- Normal errors: 3s, 6s, 12s backoff
- 503 (overloaded): 30s, 60s, 120s backoff
- Detailed error logging

**JSON Parsing**:

- Automatic cleanup of markdown code blocks
- Validation of response structure
- Detailed logging for debugging

## 🛠️ Development Commands

```bash
# Run migrations
node ace migration:run

# Rollback migrations
node ace migration:rollback

# Ingest system documents
node ace ingest:documents --clear

# Start queue worker
node ace queue:listen

# Start dev server (with hot reload)
pnpm dev

# Build for production
pnpm build

# Start production
node build/bin/server.js

# Lint & format
pnpm lint
pnpm format
```

## 📁 Files to Submit

### 1. Repository Contents

**Root Files**:

- `README.md` - This file
- `package.json` - Dependencies
- `.env.example` - Environment template
- `docker-compose.yml` - Redis setup

**Source Code** (`app/`):

- `models/` - Document, EvaluationJob, VectorEmbedding
- `controllers/` - DocumentsController, EvaluationsController
- `services/` - LlmService, VectorService, PdfParserService
- `jobs/` - EvaluateCvJob, EvaluateProjectJob, FinalAnalysisJob
- `validators/` - Request validation

**Database** (`database/`):

- `migrations/` - All migration files

**Commands** (`commands/`):

- `ingest_documents.ts` - Document ingestion script

**Storage** (`storage/system-documents/`):

- `job-descriptions/*.pdf` - Sample job descriptions
- `case-study/*.pdf` - Case study brief
- `rubrics/*.pdf` - CV & Project rubrics
- `README.md` - Instructions

### 2. Documentation Files

**Project Report** (PDF):

1. Title & Candidate Information
2. Repository Link
3. Approach & Design:
   - Initial Plan
   - System & Database Design
   - LLM Integration Strategy
   - Prompting Strategy (with examples)
   - Resilience & Error Handling
   - Edge Cases Considered
4. Results & Reflection
5. Screenshots of Real Responses:
   - `/upload` response
   - `/evaluate` response
   - `/result/:id` response (completed)
6. (Optional) Bonus Work

### 3. System Documents (PDFs)

Prepare these PDFs untuk di-ingest:

- ✅ Job Description(s) - 1-5 files
- ✅ Case Study Brief - 1 file (dokumen ini)
- ✅ CV Scoring Rubric - 1 file
- ✅ Project Scoring Rubric - 1 file

**Total**: Minimal 4 PDF files

### 4. Test Files (Optional tapi Recommended)

Untuk demo:

- Your own CV (PDF)
- Your own Project Report (PDF)

## 🧪 Testing Checklist

Before submission, test:

- [ ] Upload 2 PDFs → get document IDs
- [ ] Trigger evaluation → get job ID
- [ ] Check result while processing → status "processing"
- [ ] Wait 30 seconds
- [ ] Check result again → status "completed" with scores
- [ ] Verify cv_match_rate is between 0.0-1.0
- [ ] Verify project_score is between 1.0-5.0
- [ ] Verify overall_summary has recommendation
- [ ] Check logs show no errors
- [ ] Test with different CVs → consistent scoring

## 🔒 Error Handling Examples

### Scenario 1: API Rate Limit (503)

```
[INFO] LLM request attempt 1/3
[ERROR] LLM request failed: 503 overloaded
[INFO] Retrying in 30000ms...
[INFO] LLM request attempt 2/3
[INFO] LLM request successful
```

### Scenario 2: Invalid JSON Response

````
[ERROR] [CV Parsing] Failed to parse JSON
[ERROR] [CV Parsing] Raw response: ```json{"name":"John"...
[INFO] Cleaned response: {"name":"John"...
[INFO] Successfully parsed after cleanup
````

### Scenario 3: Job Failure

```
[ERROR] [EvaluateCvJob] Failed after 3 attempts
[INFO] Job marked as failed in database
[INFO] User can see error via GET /result/:id
```

## 📝 Scoring Parameters Detail

### CV Evaluation Parameters

| Parameter                  | Weight | Scoring (1-5)                                 | Output      |
| -------------------------- | ------ | --------------------------------------------- | ----------- |
| Technical Skills Match     | 40%    | Based on alignment with job requirements      |             |
| Experience Level           | 25%    | 1=<1yr, 2=1-2yrs, 3=2-3yrs, 4=3-4yrs, 5=5+yrs |             |
| Relevant Achievements      | 20%    | Based on measurable impact                    |             |
| Cultural/Collaboration Fit | 15%    | Based on demonstrated soft skills             |             |
| **Final CV Match Rate**    |        | Weighted avg (1-5) × 0.2                      | **0.0-1.0** |

### Project Evaluation Parameters

| Parameter                       | Weight | Scoring (1-5)                    | Output      |
| ------------------------------- | ------ | -------------------------------- | ----------- |
| Correctness (Prompt & Chaining) | 30%    | Prompt design, LLM chaining, RAG |             |
| Code Quality & Structure        | 25%    | Clean, modular, testable         |             |
| Resilience & Error Handling     | 20%    | Retries, error tracking          |             |
| Documentation & Explanation     | 15%    | README, comments, clarity        |             |
| Creativity / Bonus              | 10%    | Extra features                   |             |
| **Final Project Score**         |        | Weighted average                 | **1.0-5.0** |

## 🤝 Design Decisions & Trade-offs

### Why PostgreSQL pgvector vs ChromaDB?

**Chosen**: PostgreSQL pgvector

- ✅ Single database untuk semua data
- ✅ Production-ready dengan Neon
- ✅ ACID compliance
- ⚠️ Requires pgvector extension

### Why Gemini vs OpenAI?

**Chosen**: Google Gemini

- ✅ Generous free tier (15 RPM)
- ✅ Native JSON mode
- ✅ Good performance
- ✅ Text embedding included
- ⚠️ Rate limits require careful management

### Why Bull Queue vs Direct Processing?

**Chosen**: Bull Queue (Redis)

- ✅ Async processing (immediate response)
- ✅ Job tracking & status
- ✅ Automatic retries
- ✅ Scalable
- ⚠️ Requires Redis

### Rate Limiting Strategy

**Implementation**: 5 seconds between requests

- ✅ Safe margin below 15 RPM limit
- ✅ Prevents 503 errors
- ⚠️ Slower processing (~30s per evaluation)
- **Trade-off**: Stability over speed

## 📊 Performance Metrics

**Single Evaluation**:

- Upload: < 1 second
- Evaluation: 20-30 seconds (with rate limiting)
- Total: ~30-35 seconds end-to-end

**API Quota Usage** (per evaluation):

- LLM requests: 4 (parse CV + 3 evaluations)
- Embedding requests: 0 (only during ingestion)
- Tokens: ~6,000-8,000 total

**Daily Capacity** (free tier):

- ~375 evaluations/day (4 requests each × 1500 RPD limit)

## 🐛 Troubleshooting

### Issue: "503 Model Overloaded"

**Solution**: Implemented automatic retry with 30s, 60s, 120s backoff

### Issue: "Invalid JSON response"

**Solution**: Automatic cleanup of markdown code blocks

### Issue: Queue not processing

**Solution**: Make sure Redis is running: `docker-compose up -d`

### Issue: Vector search returns no results

**Solution**: Run `node ace ingest:documents --clear` to re-ingest

## 📚 Documentation

Dokumentasi lengkap tersedia di folder `docs/`:

### 📖 Core Documentation
- **[Documentation Index](./docs/README.md)** - Complete documentation overview
- **[API Reference](./docs/api/endpoints.md)** - Detailed API endpoints
- **[System Architecture](./docs/architecture/system-design.md)** - Architecture overview
- **[Database Schema](./docs/architecture/database-schema.md)** - Database design

### 🛠️ Development Guides
- **[Development Setup](./docs/development/setup.md)** - Setup dev environment
- **[Project Structure](./docs/development/project-structure.md)** - Codebase organization
- **[Code Style Guide](./docs/development/code-style.md)** - Coding conventions

### 🚢 Deployment
- **[Production Deployment](./docs/deployment/production.md)** - Deploy to production
- **[Environment Setup](./docs/deployment/environment.md)** - Production environment

### 🔧 Troubleshooting
- **[Common Issues](./docs/troubleshooting/common-issues.md)** - Solutions for common problems
- **[FAQ](./docs/troubleshooting/faq.md)** - Frequently asked questions

### 📋 Templates
- **[Study Case Submission](./docs/template/study-case-submission.md)** - Submission template
- **[Project Report](./docs/template/project-report.md)** - Project report example

---

## 📄 License

MIT

---

**Built for case study evaluation** - Backend Developer Position
