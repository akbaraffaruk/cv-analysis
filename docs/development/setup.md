# Development Setup Guide

Panduan lengkap setup development environment untuk CV Analysis API.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Runtime environment |
| pnpm | 8+ | Package manager |
| PostgreSQL | 14+ | Database (dengan pgvector) |
| Redis | 6+ | Queue backend |
| Git | Latest | Version control |

### Optional Tools

- **Postman** atau **Insomnia** - API testing
- **DBeaver** atau **pgAdmin** - Database management
- **RedisInsight** - Redis monitoring

---

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/username/cv-analysis.git
cd cv-analysis
```

###  2. Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install

# Or using yarn
yarn install
```

### 3. Setup Environment Variables

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env`:

```env
# Server Configuration
PORT=3333
HOST=localhost
NODE_ENV=development
APP_KEY=

# Database (PostgreSQL with pgvector)
DB_URL=postgresql://user:password@localhost:5432/cv_analysis?sslmode=disable

# Queue (Redis)
QUEUE_REDIS_HOST=127.0.0.1
QUEUE_REDIS_PORT=6379
QUEUE_REDIS_PASSWORD=

# Google Gemini AI
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
```

**Generate APP_KEY**:
```bash
node ace generate:key
```

Copy generated key ke `.env`.

---

## Database Setup

### Option 1: Local PostgreSQL

**Install PostgreSQL** (if not installed):

```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt-get install postgresql-14
sudo systemctl start postgresql

# Windows
# Download installer from https://www.postgresql.org/download/windows/
```

**Create Database**:

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE cv_analysis;

# Create user (optional)
CREATE USER cv_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE cv_analysis TO cv_user;

# Exit
\q
```

**Install pgvector Extension**:

```bash
# macOS
brew install pgvector

# Ubuntu/Debian
sudo apt-get install postgresql-14-pgvector

# Or compile from source
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

**Enable Extension**:

```sql
psql cv_analysis

CREATE EXTENSION vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
\q
```

### Option 2: Neon (Cloud PostgreSQL)

**Recommended untuk development**.

1. Sign up di [Neon](https://neon.tech)
2. Create new project
3. Copy connection string
4. Update `.env`:
```env
DB_URL=postgresql://user:password@ep-xxx.neon.tech/cv_analysis?sslmode=require
```
5. pgvector sudah included

---

## Redis Setup

### Option 1: Docker (Recommended)

```bash
# Using docker-compose.yml yang sudah disediakan
docker-compose up -d redis

# Verify
docker ps
# Should show redis container

# Test connection
docker exec -it cv-analysis-redis-1 redis-cli ping
# Should return: PONG
```

### Option 2: Local Redis

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Windows
# Download from https://github.com/microsoftarchive/redis/releases
```

**Test Connection**:
```bash
redis-cli ping
# Should return: PONG
```

---

## Run Migrations

```bash
# Run all migrations
node ace migration:run
```

**Expected Output**:
```
❯ migrated database/migrations/1761121344443_create_enable_pgvector_extensions_table
❯ migrated database/migrations/1761121324455_create_documents_table
❯ migrated database/migrations/1761121292673_create_evaluation_jobs_table
❯ migrated database/migrations/1761121303791_create_vector_embeddings_table
```

**Verify Tables**:
```bash
psql $DB_URL

\dt
# Should show:
# documents
# evaluation_jobs  
# vector_embeddings

\q
```

---

## Prepare System Documents

### Create Directories

```bash
mkdir -p storage/system-documents/{job-descriptions,case-study,rubrics}
mkdir -p storage/uploads/{cv,project-report}
```

### Add System Documents

**1. Job Descriptions** (1-5 PDFs):
```bash
cp your-job-description.pdf storage/system-documents/job-descriptions/
```

**2. Case Study Brief** (1 PDF):
```bash
cp case-study-brief.pdf storage/system-documents/case-study/
```

**3. CV Rubric** (1 PDF):
```bash
# Option 1: Use provided template
cd docs/template
pandoc cv-rubric.md -o cv-rubric.pdf
cp cv-rubric.pdf ../../storage/system-documents/rubrics/

# Option 2: Use your own
cp your-cv-rubric.pdf storage/system-documents/rubrics/
```

**4. Project Rubric** (1 PDF):
```bash
# Option 1: Use provided template
cd docs/template
pandoc project-rubric.md -o project-rubric.pdf
cp project-rubric.pdf ../../storage/system-documents/rubrics/

# Option 2: Use your own
cp your-project-rubric.pdf storage/system-documents/rubrics/
```

### Ingest Documents

```bash
node ace ingest:documents --clear
```

**Expected Output**:
```
Starting document ingestion...

Ingesting Job Descriptions...
  Processing: backend-developer-jd.pdf
  ✓ backend-developer-jd.pdf ingested (5 chunks)

Ingesting Case Study...
  Processing: case-study-brief.pdf
  ✓ case-study-brief.pdf ingested (8 chunks)

Ingesting CV Rubrics...
  Processing: cv-rubric.pdf
  ✓ cv-rubric.pdf ingested (5 chunks)

Ingesting Project Rubrics...
  Processing: project-rubric.pdf
  ✓ project-rubric.pdf ingested (6 chunks)

✓ All documents ingested successfully
```

**Note**: Ingestion memakan waktu ~2-5 menit karena rate limiting.

---

## Start Development

### Terminal 1: Queue Worker

```bash
node ace queue:listen
```

**Expected Output**:
```
[INFO] Queue worker started
[INFO] Listening for jobs on queue: default
```

**Keep this running** - akan process evaluation jobs.

### Terminal 2: API Server

```bash
pnpm dev
```

**Expected Output**:
```
[INFO] Starting HTTP server
[INFO] Server started on http://localhost:3333
```

API siap menerima requests di `http://localhost:3333`

---

## Verify Setup

### 1. Health Check

```bash
curl http://localhost:3333/
# Should return API info
```

### 2. Upload Test

```bash
curl -X POST http://localhost:3333/upload \
  -F "cv=@test-cv.pdf" \
  -F "project_report=@test-report.pdf"
```

Should return document IDs.

### 3. Trigger Evaluation

```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Backend Developer",
    "cv_document_id": 1,
    "project_document_id": 2
  }'
```

Should return job ID.

### 4. Check Result

```bash
curl http://localhost:3333/result/<job_id>
```

Wait ~30 seconds, then check again. Should return completed evaluation.

---

## Development Workflow

### Code Changes

1. **Edit code** di `app/` directory
2. **Server auto-reloads** (hot reload enabled)
3. **Test endpoint** via Postman/curl
4. **Check logs** in terminal

### Database Changes

1. **Create migration**:
```bash
node ace make:migration create_new_table
```

2. **Edit migration** file di `database/migrations/`

3. **Run migration**:
```bash
node ace migration:run
```

### Add New Endpoint

1. **Create route** di `start/routes.ts`:
```typescript
router.get('/new-endpoint', 'NewController.index')
```

2. **Create controller**:
```bash
node ace make:controller NewController
```

3. **Implement logic** di `app/controllers/new_controller.ts`

4. **Test** endpoint

---

## IDE Setup

### VS Code (Recommended)

**Install Extensions**:
- ESLint
- Prettier
- AdonisJS Extension
- PostgreSQL
- Redis

**Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### WebStorm/IntelliJ IDEA

- Enable TypeScript support
- Configure ESLint
- Configure Prettier
- Install AdonisJS plugin

---

## Debugging

### Debug API Server

**VS Code Launch Configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API Server",
      "runtimeExecutable": "node",
      "runtimeArgs": ["ace", "serve", "--hmr"],
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### Debug Queue Worker

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Queue Worker",
  "runtimeExecutable": "node",
  "runtimeArgs": ["ace", "queue:listen"],
  "skipFiles": ["<node_internals>/**"]
}
```

### Debug Tips

1. **Add breakpoints** di VS Code
2. **Use `console.log()`** untuk quick debugging
3. **Check logs** di terminal
4. **Use debugger statement** in code:
```typescript
debugger // Execution will pause here
```

---

## Testing

### Manual Testing

**API Testing dengan Postman**:
1. Import collection dari `docs/api/postman/`
2. Set environment variables
3. Run requests

**Database Testing**:
```bash
psql $DB_URL

-- Check data
SELECT * FROM documents;
SELECT * FROM evaluation_jobs;
SELECT * FROM vector_embeddings LIMIT 5;
```

**Queue Testing**:
```bash
# Check queue depth
redis-cli LLEN bull:default:wait

# Check failed jobs
redis-cli ZCARD bull:default:failed
```

### Automated Testing (Future)

```bash
# Run unit tests
node ace test

# Run with coverage
node ace test --coverage
```

---

## Common Development Tasks

### Reset Database

```bash
# Rollback all migrations
node ace migration:rollback --batch=0

# Re-run migrations
node ace migration:run

# Re-ingest documents
node ace ingest:documents --clear
```

### Clear Queue

```bash
# Clear all jobs dari Redis
redis-cli FLUSHDB

# Or selective clear
redis-cli DEL bull:default:wait
redis-cli DEL bull:default:active
redis-cli DEL bull:default:failed
```

### View Logs

```bash
# API server logs (in terminal running pnpm dev)

# Queue worker logs (in terminal running queue:listen)

# Database logs
tail -f /var/log/postgresql/postgresql-14-main.log

# Redis logs  
tail -f /var/log/redis/redis-server.log
```

---

## Troubleshooting Development Issues

See [Common Issues](../troubleshooting/common-issues.md) untuk detailed troubleshooting.

**Quick Fixes**:

**"Cannot connect to database"**:
```bash
psql $DB_URL  # Test connection
```

**"Redis connection refused"**:
```bash
docker-compose up -d redis  # Start Redis
```

**"Migration failed"**:
```bash
node ace migration:rollback
node ace migration:run
```

---

## Next Steps

- [Project Structure](./project-structure.md) - Understand codebase organization
- [Code Style Guide](./code-style.md) - Follow coding conventions
- [API Documentation](../api/endpoints.md) - Learn API endpoints

---

**Happy Coding! 🚀**

