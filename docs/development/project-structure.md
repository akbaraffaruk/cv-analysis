# Project Structure

Overview struktur folder dan file dalam codebase.

---

## Directory Tree

```
cv-analysis/
├── app/                       # Application code
│   ├── controllers/          # HTTP controllers
│   ├── exceptions/           # Exception handlers
│   ├── jobs/                 # Queue jobs
│   ├── middleware/           # HTTP middleware
│   ├── models/               # Database models (Lucid ORM)
│   ├── services/             # Business logic services
│   └── validators/           # Request validators
├── bin/                      # Executable scripts
│   ├── console.ts           # Console commands entry
│   ├── server.ts            # HTTP server entry
│   └── test.ts              # Test runner entry
├── commands/                 # Custom Ace commands
│   └── ingest_documents.ts  # Document ingestion script
├── config/                   # Configuration files
│   ├── app.ts               # App config
│   ├── auth.ts              # Auth config
│   ├── bodyparser.ts        # Body parser config
│   ├── cors.ts              # CORS config
│   ├── database.ts          # Database config
│   ├── hash.ts              # Hash config
│   ├── logger.ts            # Logger config
│   └── queue.ts             # Queue config
├── database/                 # Database files
│   └── migrations/          # Migration files
├── docs/                     # Documentation
│   ├── api/                 # API documentation
│   ├── architecture/        # Architecture docs
│   ├── development/         # Development guides
│   ├── deployment/          # Deployment guides
│   ├── troubleshooting/     # Troubleshooting
│   └── template/            # Templates
├── start/                    # Bootstrap files
│   ├── env.ts               # Environment validation
│   ├── kernel.ts            # HTTP kernel
│   └── routes.ts            # Route definitions
├── storage/                  # Storage directory
│   ├── system-documents/    # RAG documents
│   │   ├── job-descriptions/
│   │   ├── case-study/
│   │   └── rubrics/
│   └── uploads/             # Uploaded PDFs
│       ├── cv/
│       └── project-report/
├── tests/                    # Test files
│   └── bootstrap.ts
├── .env                      # Environment variables (not in git)
├── .env.example             # Environment template
├── .gitignore               # Git ignore rules
├── adonisrc.ts              # AdonisJS config
├── docker-compose.yml       # Docker services
├── eslint.config.js         # ESLint config
├── package.json             # Dependencies
├── pnpm-lock.yaml           # Lock file
├── README.md                # Main documentation
└── tsconfig.json            # TypeScript config
```

---

## Key Directories

### `/app`

Application core code.

#### `/app/controllers`

HTTP request handlers.

**Files**:
- `documents_controller.ts` - Document upload/management
- `evaluations_controller.ts` - Evaluation triggers & results

**Pattern**:
```typescript
export default class DocumentsController {
  async upload({ request, response }: HttpContext) {
    // Handle request
    // Return response
  }
}
```

#### `/app/jobs`

Background queue jobs (Bull Queue).

**Files**:
- `evaluate_cv_job.ts` - CV evaluation logic
- `evaluate_project_job.ts` - Project evaluation logic
- `final_analysis_job.ts` - Final analysis synthesis

**Pattern**:
```typescript
export default class EvaluateCvJob {
  async handle(payload: { jobId: string }) {
    // Job logic
    // Dispatch next job
  }
}
```

#### `/app/models`

Database models (Lucid ORM).

**Files**:
- `document.ts` - Document model
- `evaluation_job.ts` - EvaluationJob model
- `vector_embedding.ts` - VectorEmbedding model

**Pattern**:
```typescript
export default class Document extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: string
}
```

#### `/app/services`

Business logic layer.

**Files**:
- `llm_service.ts` - Gemini API integration
- `vector_service.ts` - RAG operations
- `pdf_parser_service.ts` - PDF text extraction

**Pattern**:
```typescript
export class LlmService {
  async generateContent(prompt: string): Promise<string> {
    // Service logic
  }
}
```

#### `/app/validators`

Request validation schemas.

**Files**:
- `document_validator.ts` - Document upload validation
- `evaluation_validator.ts` - Evaluation request validation

**Pattern**:
```typescript
export const createDocumentValidator = vine.compile(
  vine.object({
    cv: vine.file({ extnames: ['pdf'], size: '10mb' }),
    project_report: vine.file({ extnames: ['pdf'], size: '10mb' })
  })
)
```

---

### `/commands`

Custom Ace CLI commands.

**Files**:
- `ingest_documents.ts` - Document ingestion command

**Usage**:
```bash
node ace ingest:documents --clear
```

---

### `/config`

Configuration files for various services.

**Key Files**:
- `database.ts` - PostgreSQL connection
- `queue.ts` - Bull Queue configuration
- `app.ts` - Application settings

---

### `/database/migrations`

Database schema migrations.

**Files** (in order):
1. `1761121344443_create_enable_pgvector_extensions_table.ts`
2. `1761121324455_create_documents_table.ts`
3. `1761121292673_create_evaluation_jobs_table.ts`
4. `1761121303791_create_vector_embeddings_table.ts`

**Pattern**:
```typescript
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('table_name', (table) => {
      // Schema definition
    })
  }

  async down() {
    this.schema.dropTable('table_name')
  }
}
```

---

### `/docs`

Complete documentation (you are here!).

See [Documentation Index](../README.md).

---

### `/start`

Application bootstrap files.

**Files**:
- `env.ts` - Environment variable validation
- `kernel.ts` - Middleware registration
- `routes.ts` - Route definitions

---

### `/storage`

File storage directory.

#### `/storage/system-documents`

RAG ground truth documents (ingested to vector DB).

**Structure**:
```
system-documents/
├── job-descriptions/     # Job description PDFs
├── case-study/          # Case study brief PDF
└── rubrics/             # Scoring rubric PDFs
    ├── cv-rubric.pdf
    └── project-rubric.pdf
```

#### `/storage/uploads`

User-uploaded files.

**Structure**:
```
uploads/
├── cv/                  # CV PDFs
│   └── 1730000000000_john-doe-cv.pdf
└── project-report/      # Project report PDFs
    └── 1730000001000_john-project.pdf
```

**Naming**: `{timestamp}_{original_name}.pdf`

---

## Important Files

### Root Files

#### `adonisrc.ts`

AdonisJS configuration.

**Key settings**:
- Providers: Registered service providers
- Commands: Custom Ace commands
- Aliases: Path aliases

#### `package.json`

Dependencies and scripts.

**Key scripts**:
- `dev` - Start dev server with hot reload
- `build` - Build for production
- `start` - Start production server
- `lint` - Run ESLint
- `format` - Format code dengan Prettier

#### `tsconfig.json`

TypeScript configuration.

**Key settings**:
- `strict: true` - Strict type checking
- `esModuleInterop: true` - CommonJS compatibility
- Paths: Import aliases

#### `docker-compose.yml`

Docker services (Redis).

**Services**:
- `redis` - Queue backend

---

## Code Organization Patterns

### Controller → Service → Model

**Flow**:
```
HTTP Request
  ↓
Controller (validates & handles request)
  ↓
Service (business logic)
  ↓
Model (database operations)
  ↓
Response
```

**Example**:
```typescript
// Controller
class DocumentsController {
  async upload({ request }: HttpContext) {
    const data = await request.validateUsing(validator)
    const doc = await documentService.create(data) // Service
    return doc
  }
}

// Service
class DocumentService {
  async create(data: any) {
    const doc = await Document.create(data) // Model
    return doc
  }
}

// Model
class Document extends BaseModel {
  // Database operations handled by Lucid
}
```

### Job Chaining

**Pattern**:
```typescript
// Job 1
class EvaluateCvJob {
  async handle({ jobId }: { jobId: string }) {
    // Process CV
    await evaluationJob.save()
    
    // Dispatch next job
    await dispatch(EvaluateProjectJob, { jobId })
  }
}

// Job 2
class EvaluateProjectJob {
  async handle({ jobId }: { jobId: string }) {
    // Process project
    await evaluationJob.save()
    
    // Dispatch final job
    await dispatch(FinalAnalysisJob, { jobId })
  }
}
```

---

## Configuration Files

### Environment Variables (`.env`)

**Categories**:
1. **Server**: PORT, HOST, NODE_ENV, APP_KEY
2. **Database**: DB_URL
3. **Queue**: QUEUE_REDIS_*
4. **LLM**: GEMINI_API_KEY, GEMINI_MODEL

### Validation (`start/env.ts`)

All env vars validated at startup:
```typescript
export default await Env.create(new URL('../', import.meta.url), {
  GEMINI_API_KEY: Env.schema.string(),
  DB_URL: Env.schema.string(),
  // ...
})
```

---

## File Naming Conventions

### Files

- **Controllers**: `{name}_controller.ts` (snake_case)
- **Models**: `{name}.ts` (snake_case for file, PascalCase for class)
- **Services**: `{name}_service.ts` (snake_case)
- **Jobs**: `{name}_job.ts` (snake_case)
- **Validators**: `{name}_validator.ts` (snake_case)

### Classes

- **PascalCase**: `DocumentsController`, `LlmService`
- **Methods**: `camelCase`
- **Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

---

## Import Aliases

Configured in `tsconfig.json`:

```typescript
// Instead of:
import { Document } from '../../app/models/document.js'

// Use:
import Document from '#models/document'
```

**Aliases**:
- `#models` → `app/models`
- `#services` → `app/services`
- `#controllers` → `app/controllers`
- `#validators` → `app/validators`
- `#jobs` → `app/jobs`

---

## Adding New Features

### 1. New Model

```bash
node ace make:model NewModel
```

Creates: `app/models/new_model.ts`

### 2. New Migration

```bash
node ace make:migration create_new_table
```

Creates: `database/migrations/{timestamp}_create_new_table.ts`

### 3. New Controller

```bash
node ace make:controller NewController
```

Creates: `app/controllers/new_controller.ts`

### 4. New Command

```bash
node ace make:command NewCommand
```

Creates: `commands/new_command.ts`

---

**Next**: [Code Style Guide](./code-style.md) | [Development Setup](./setup.md)

