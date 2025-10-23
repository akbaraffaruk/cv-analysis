# Common Issues & Solutions

Troubleshooting guide untuk issues yang sering terjadi.

---

## Database Issues

### Issue: Cannot connect to database

**Error**:
```
ER_CONNECTION_REFUSED: Cannot connect to PostgreSQL
```

**Solutions**:

1. **Check connection string**:
```bash
# Verify DB_URL in .env
echo $DB_URL
```

2. **Test connection**:
```bash
psql $DB_URL
```

3. **Check pgvector extension**:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

If not installed:
```sql
CREATE EXTENSION vector;
```

---

### Issue: Migration failed

**Error**:
```
Error: relation "documents" already exists
```

**Solution**:

```bash
# Check migration status
node ace migration:status

# Rollback and re-run
node ace migration:rollback
node ace migration:run
```

---

### Issue: Invalid byte sequence for encoding "UTF8": 0x00

**Error**:
```
ERROR: invalid byte sequence for encoding "UTF8": 0x00
```

**Cause**: PDF contains null bytes yang tidak compatible dengan PostgreSQL TEXT.

**Solution**: Text cleaning sudah implemented di `pdf_parser_service.ts` dan `vector_service.ts`.

Jika masih terjadi:
```typescript
// Clean text manually
const cleaned = text.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
```

---

## Redis/Queue Issues

### Issue: Queue not processing jobs

**Error**:
```
Jobs stuck in "queued" status
```

**Solutions**:

1. **Check Redis running**:
```bash
# Test Redis connection
redis-cli ping
# Should return: PONG
```

2. **Start queue worker**:
```bash
node ace queue:listen
```

3. **Check queue worker logs**:
```bash
# Should see:
# [INFO] Queue worker started
# [INFO] Listening for jobs...
```

---

### Issue: Redis connection refused

**Error**:
```
ECONNREFUSED 127.0.0.1:6379
```

**Solutions**:

1. **Start Redis via Docker**:
```bash
docker-compose up -d redis
```

2. **Or start Redis locally**:
```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis
```

3. **Verify Redis is running**:
```bash
docker ps
# Should show redis container
```

---

## LLM/Gemini API Issues

### Issue: 503 Model Overloaded

**Error**:
```json
{
  "error": {
    "code": 503,
    "message": "The model is overloaded. Please try again later.",
    "status": "UNAVAILABLE"
  }
}
```

**Solution**: 

Automatic retry dengan exponential backoff sudah diimplementasikan:
- Attempt 1: Wait 30s
- Attempt 2: Wait 60s
- Attempt 3: Wait 120s

Jika masih gagal:
1. Check API quota di [Google AI Studio](https://aistudio.google.com/)
2. Increase rate limiting delay di `app/services/llm_service.ts`:
```typescript
private minRequestInterval = 10000 // 10 detik instead of 5
```

---

### Issue: Invalid API Key

**Error**:
```
Failed to generate content: API key not valid
```

**Solutions**:

1. **Verify API key**:
```bash
echo $GEMINI_API_KEY
```

2. **Get new API key**:
- Visit [Google AI Studio](https://aistudio.google.com/apikey)
- Create new API key
- Update `.env`:
```env
GEMINI_API_KEY=your_new_api_key_here
```

3. **Restart server**:
```bash
pnpm dev
```

---

### Issue: Rate limit exceeded (429)

**Error**:
```
Rate limit exceeded: 15 RPM
```

**Solution**:

Rate limiting sudah implemented (5s between requests).

Untuk mengurangi RPM lebih lanjut:
```typescript
// app/services/llm_service.ts
private minRequestInterval = 8000 // 7.5 RPM
```

---

### Issue: Invalid JSON response from LLM

**Error**:
```
Failed to parse JSON: Unexpected token ` in JSON at position 0
```

**Cause**: LLM wraps JSON dengan markdown code blocks.

**Solution**: Automatic cleanup sudah implemented di `llm_service.ts`:
```typescript
cleanJsonResponse(text: string): string {
  return text
    .replace(/^```json\n?/i, '')
    .replace(/^```\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()
}
```

Jika masih terjadi, check logs:
```bash
# Should see:
# [ERROR] Failed to parse JSON
# [ERROR] Raw response: ...
# [INFO] Cleaned response: ...
```

---

## PDF Parsing Issues

### Issue: Cannot parse PDF

**Error**:
```
PDF parsing failed: Please provide binary data as Uint8Array
```

**Solution**: 

Already fixed di `pdf_parser_service.ts`. Update code jika masih terjadi:
```typescript
const buffer = await fs.readFile(filePath)
const uint8Array = new Uint8Array(buffer)
const data = await PDFParse(uint8Array)
```

---

### Issue: Empty extracted text

**Error**:
```
Extracted text length is too short (< 100 characters)
```

**Causes**:
1. PDF contains only images (scanned document)
2. PDF has security restrictions
3. PDF corrupted

**Solutions**:

1. **For scanned PDFs**: Use OCR tool first
2. **For protected PDFs**: Remove protection
3. **For corrupted PDFs**: Re-create PDF

**Check extracted text**:
```bash
curl http://localhost:3333/documents/:id
# Check "extracted_text" field
```

---

## Document Ingestion Issues

### Issue: No system documents found

**Error**:
```
Warning: No PDF files found in storage/system-documents/job-descriptions/
```

**Solution**:

1. **Check folder structure**:
```bash
ls -la storage/system-documents/
# Should have:
# job-descriptions/
# case-study/
# rubrics/
```

2. **Add PDF files**:
```bash
# Copy your PDFs
cp your-jd.pdf storage/system-documents/job-descriptions/
cp case-study.pdf storage/system-documents/case-study/
cp cv-rubric.pdf storage/system-documents/rubrics/
cp project-rubric.pdf storage/system-documents/rubrics/
```

3. **Re-run ingestion**:
```bash
node ace ingest:documents --clear
```

---

### Issue: Ingestion takes too long

**Cause**: Rate limiting (5s per embedding).

**Current Performance**:
- 1 chunk = 1 embedding = ~5 seconds
- 50 chunks = ~4 minutes

**Solutions**:

1. **Reduce chunk count**: Use smaller documents
2. **Use paid tier**: Higher RPM limit
3. **Pre-generate embeddings**: Run ingestion offline

---

## Evaluation Issues

### Issue: Evaluation stuck in "processing"

**Symptoms**:
```json
{
  "status": "processing",
  "started_at": "2024-10-23T14:30:00.000Z"
}
```

**Solutions**:

1. **Check queue worker logs**:
```bash
# Terminal running `node ace queue:listen`
# Look for errors
```

2. **Check job retries**:
```bash
curl http://localhost:3333/result/:id
# Check "retry_count"
```

3. **Manual retry**: Re-trigger evaluation jika needed

---

### Issue: Evaluation failed after 3 attempts

**Error**:
```json
{
  "status": "failed",
  "error_message": "Failed to generate content after 3 attempts",
  "retry_count": 3
}
```

**Solutions**:

1. **Check error message** untuk root cause
2. **Common causes**:
   - API rate limit exceeded
   - Invalid API key
   - Network timeout
   - Model overloaded (503)

3. **Fix underlying issue**, then re-upload dan re-evaluate

---

## Environment Issues

### Issue: Missing environment variables

**Error**:
```
EnvValidationException: Missing environment variable "GEMINI_API_KEY"
```

**Solution**:

1. **Copy .env.example**:
```bash
cp .env.example .env
```

2. **Fill required variables**:
```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
DB_URL=postgresql://user:password@host/database
QUEUE_REDIS_HOST=127.0.0.1
QUEUE_REDIS_PORT=6379
```

3. **Generate APP_KEY**:
```bash
node ace generate:key
```

---

## Performance Issues

### Issue: Slow API responses

**Symptoms**:
- Upload takes > 2 seconds
- Evaluation takes > 40 seconds

**Solutions**:

1. **Check database latency**:
```sql
\timing
SELECT COUNT(*) FROM documents;
-- Should be < 50ms
```

2. **Check Redis latency**:
```bash
redis-cli --latency
# Should be < 10ms average
```

3. **Optimize pgvector index**:
```sql
-- Rebuild index
DROP INDEX vector_embeddings_embedding_idx;
CREATE INDEX ON vector_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

4. **Enable connection pooling** di `config/database.ts`

---

## Disk Space Issues

### Issue: Storage full

**Check disk usage**:
```bash
du -sh storage/uploads/
```

**Cleanup old uploads**:
```bash
# Delete uploads older than 30 days
find storage/uploads/ -type f -mtime +30 -delete
```

**Implement cleanup job**:
```typescript
// Schedule daily cleanup
// Delete documents older than 30 days
await Document.query()
  .where('created_at', '<', DateTime.now().minus({ days: 30 }))
  .delete()
```

---

## Debug Mode

### Enable detailed logging

```env
# .env
NODE_ENV=development
LOG_LEVEL=debug
```

### Check logs

```bash
# API server logs
tail -f logs/app.log

# Queue worker logs
# Terminal running queue:listen
```

---

## Getting Help

Jika issue masih belum resolved:

1. **Check logs** untuk detailed error messages
2. **Search existing issues** di repository
3. **Create new issue** dengan:
   - Error message lengkap
   - Steps to reproduce
   - Environment details (OS, Node version, etc)
   - Relevant logs

---

**Next**: [FAQ](./faq.md) | [Performance Tuning](./performance.md)

