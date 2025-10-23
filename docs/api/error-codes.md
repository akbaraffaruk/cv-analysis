# Error Codes Reference

Complete list of error codes dan cara handling-nya.

---

## HTTP Status Codes

| Status Code | Name | When It Occurs |
|-------------|------|----------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created (e.g., evaluation started) |
| 400 | Bad Request | Invalid request parameters |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 413 | Payload Too Large | File size exceeds limit |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Temporary unavailability |

---

## Validation Errors (422)

### Missing Required Field

```json
{
  "errors": [
    {
      "field": "job_title",
      "message": "Job title is required",
      "rule": "required"
    }
  ]
}
```

**How to fix**: Include required field in request body.

---

### Invalid Field Type

```json
{
  "errors": [
    {
      "field": "cv_document_id",
      "message": "The cv_document_id field must be a number",
      "rule": "number"
    }
  ]
}
```

**How to fix**: Ensure field has correct data type.

---

### Invalid File Format

```json
{
  "errors": [
    {
      "field": "cv",
      "message": "File must be PDF format",
      "rule": "file.extname"
    }
  ]
}
```

**How to fix**: Upload PDF file only.

---

## Resource Errors (404, 409)

### Document Not Found

```json
{
  "message": "Document not found"
}
```

**Possible causes**:
- Invalid document ID
- Document was deleted
- Wrong database

**How to fix**: Verify document ID exists.

---

### Evaluation Job Not Found

```json
{
  "message": "Evaluation job not found"
}
```

**Possible causes**:
- Invalid job ID (UUID)
- Job was never created
- Database connection issue

**How to fix**: Verify job ID from `/evaluate` response.

---

### Resource Conflict

```json
{
  "message": "Cannot delete document: used in active evaluation"
}
```

**How to fix**: Wait for evaluation to complete or cancel it first.

---

## File Upload Errors (400, 413)

### File Too Large

```json
{
  "message": "File size exceeds maximum limit of 10MB"
}
```

**How to fix**: 
- Compress PDF
- Remove images from PDF
- Split into multiple files

---

### Empty File

```json
{
  "message": "File cannot be empty"
}
```

**How to fix**: Upload non-empty file.

---

### PDF Parsing Failed

```json
{
  "message": "PDF parsing failed: Cannot read PDF structure"
}
```

**Possible causes**:
- Corrupted PDF
- Password-protected PDF
- Scanned image (no text)

**How to fix**:
- Re-create PDF
- Remove password
- Use OCR for scanned documents

---

## Rate Limiting Errors (429)

### Rate Limit Exceeded

```json
{
  "message": "Rate limit exceeded. Please try again later.",
  "retry_after": 60
}
```

**How to fix**: Wait for `retry_after` seconds before retrying.

**Prevention**: 
- Implement client-side throttling
- Use queue for batch processing

---

## LLM API Errors (503)

### Model Overloaded

```json
{
  "error": {
    "code": 503,
    "message": "The model is overloaded. Please try again later.",
    "status": "UNAVAILABLE"
  }
}
```

**Automatic handling**: System retries dengan exponential backoff (30s, 60s, 120s).

**Manual handling**: Check quota di Google AI Studio.

---

### Invalid API Key

```json
{
  "message": "Failed to generate content: API key not valid"
}
```

**How to fix**:
1. Get new API key dari [Google AI Studio](https://aistudio.google.com/apikey)
2. Update `.env`:
   ```env
   GEMINI_API_KEY=your_new_key
   ```
3. Restart server

---

## Database Errors (500)

### Connection Failed

```json
{
  "message": "Database connection failed"
}
```

**How to fix**:
1. Check DB_URL in `.env`
2. Test connection: `psql $DB_URL`
3. Verify database is running

---

### Invalid Byte Sequence (UTF8)

```json
{
  "message": "invalid byte sequence for encoding \"UTF8\": 0x00"
}
```

**Cause**: PDF contains null bytes.

**Solution**: Already handled by text cleaning. If persists, report bug.

---

## Queue/Redis Errors (500)

### Redis Connection Refused

```json
{
  "message": "ECONNREFUSED 127.0.0.1:6379"
}
```

**How to fix**:
```bash
docker-compose up -d redis
```

---

### Job Failed After Max Retries

```json
{
  "id": "a1b2c3d4-...",
  "status": "failed",
  "error_message": "Failed after 3 attempts: Model overloaded",
  "retry_count": 3
}
```

**How to fix**: 
- Check underlying cause in `error_message`
- Fix issue (e.g., wait for API quota)
- Re-trigger evaluation

---

## Error Response Format

All errors follow consistent format:

### Single Error

```json
{
  "message": "Error description"
}
```

### Validation Errors (Multiple)

```json
{
  "errors": [
    {
      "field": "field_name",
      "message": "Error message",
      "rule": "validation_rule"
    }
  ]
}
```

### LLM API Errors

```json
{
  "error": {
    "code": 503,
    "message": "Error message",
    "status": "ERROR_STATUS"
  }
}
```

---

## Error Handling Best Practices

### Client-Side

**1. Check Response Status**:
```javascript
const response = await fetch('/api/endpoint')
if (!response.ok) {
  const error = await response.json()
  handleError(error)
}
```

**2. Implement Retry Logic**:
```javascript
async function withRetry(fn, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxAttempts - 1) throw error
      await delay(1000 * (i + 1)) // Exponential backoff
    }
  }
}
```

**3. Display User-Friendly Messages**:
```javascript
function getErrorMessage(error) {
  if (error.errors) {
    return error.errors.map(e => e.message).join(', ')
  }
  return error.message || 'Something went wrong'
}
```

### Server-Side

**1. Catch All Errors**:
```typescript
try {
  // Your code
} catch (error) {
  logger.error('Operation failed', { error })
  throw error // Re-throw for global handler
}
```

**2. Use Custom Exceptions**:
```typescript
class DocumentNotFoundError extends Error {
  constructor(id: number) {
    super(`Document ${id} not found`)
    this.name = 'DocumentNotFoundError'
  }
}
```

**3. Global Error Handler**:
Already implemented di `app/exceptions/handler.ts`.

---

## Debugging Errors

### 1. Check Logs

**API Server**:
```bash
# Terminal running pnpm dev
```

**Queue Worker**:
```bash
# Terminal running queue:listen
```

### 2. Verify Environment

```bash
# Check all required vars
cat .env | grep -E "GEMINI_API_KEY|DB_URL|QUEUE_REDIS"
```

### 3. Test Individual Components

```bash
# Test database
psql $DB_URL

# Test Redis
redis-cli ping

# Test Gemini API
curl https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
```

---

**See Also**: 
- [Common Issues](../troubleshooting/common-issues.md)
- [FAQ](../troubleshooting/faq.md)

