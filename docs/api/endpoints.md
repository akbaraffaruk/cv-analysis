# API Endpoints Documentation

Complete API reference untuk CV Analysis API.

---

## Base URL

```
Development: http://localhost:3333
Production: https://your-domain.com
```

---

## Authentication

Saat ini API tidak memerlukan authentication (fokus pada core functionality).

---

## Endpoints Overview

| Method | Endpoint | Description | Response Time |
|--------|----------|-------------|---------------|
| POST | `/upload` | Upload CV & Project Report | < 1s |
| GET | `/documents/:id` | Get document details | < 100ms |
| DELETE | `/documents/:id` | Delete document | < 200ms |
| POST | `/evaluate` | Trigger evaluation | < 200ms |
| GET | `/result/:id` | Get evaluation result | < 100ms |
| GET | `/evaluations` | List all evaluations | < 200ms |

---

## 1. Upload Documents

Upload CV dan Project Report untuk evaluation.

### Endpoint
```
POST /upload
```

### Request

**Content-Type**: `multipart/form-data`

**Body Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cv` | File | Yes | PDF file CV kandidat (max 10MB) |
| `project_report` | File | Yes | PDF file project report (max 10MB) |

**Example Request**:
```bash
curl -X POST http://localhost:3333/upload \
  -F "cv=@john-doe-cv.pdf" \
  -F "project_report=@john-project-report.pdf"
```

### Response

**Success (200)**:
```json
{
  "message": "Documents uploaded successfully",
  "data": {
    "cv": {
      "id": 1,
      "type": "cv",
      "original_name": "john-doe-cv.pdf",
      "file_path": "storage/uploads/cv/1730000000000_john-doe-cv.pdf",
      "mime_type": "application/pdf",
      "file_size": 245678,
      "created_at": "2024-10-23T14:30:00.000Z",
      "updated_at": "2024-10-23T14:30:00.000Z"
    },
    "project_report": {
      "id": 2,
      "type": "project_report",
      "original_name": "john-project-report.pdf",
      "file_path": "storage/uploads/project-report/1730000001000_john-project-report.pdf",
      "mime_type": "application/pdf",
      "file_size": 512345,
      "created_at": "2024-10-23T14:30:01.000Z",
      "updated_at": "2024-10-23T14:30:01.000Z"
    }
  }
}
```

**Error Responses**:

**400 Bad Request** - Invalid file format:
```json
{
  "errors": [
    {
      "field": "cv",
      "message": "File must be PDF format"
    }
  ]
}
```

**413 Payload Too Large** - File too large:
```json
{
  "message": "File size exceeds maximum limit of 10MB"
}
```

---

## 2. Get Document Details

Retrieve metadata dari uploaded document.

### Endpoint
```
GET /documents/:id
```

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Integer | Document ID dari upload response |

### Request

**Example Request**:
```bash
curl http://localhost:3333/documents/1
```

### Response

**Success (200)**:
```json
{
  "data": {
    "id": 1,
    "type": "cv",
    "original_name": "john-doe-cv.pdf",
    "file_path": "storage/uploads/cv/1730000000000_john-doe-cv.pdf",
    "mime_type": "application/pdf",
    "file_size": 245678,
    "extracted_text": "JOHN DOE\nBackend Developer\n...",
    "created_at": "2024-10-23T14:30:00.000Z",
    "updated_at": "2024-10-23T14:30:00.000Z"
  }
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "message": "Document not found"
}
```

---

## 3. Delete Document

Delete uploaded document dari storage dan database.

### Endpoint
```
DELETE /documents/:id
```

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Integer | Document ID yang akan dihapus |

### Request

**Example Request**:
```bash
curl -X DELETE http://localhost:3333/documents/1
```

### Response

**Success (200)**:
```json
{
  "message": "Document deleted successfully"
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "message": "Document not found"
}
```

**409 Conflict** - Document digunakan dalam evaluation:
```json
{
  "message": "Cannot delete document: used in active evaluation"
}
```

---

## 4. Trigger Evaluation

Mulai proses evaluation asynchronous untuk CV dan Project Report.

### Endpoint
```
POST /evaluate
```

### Request

**Content-Type**: `application/json`

**Body Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_title` | String | Yes | Job title untuk evaluation context |
| `cv_document_id` | Integer | Yes | ID dari uploaded CV document |
| `project_document_id` | Integer | Yes | ID dari uploaded project report |

**Example Request**:
```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Backend Developer",
    "cv_document_id": 1,
    "project_document_id": 2
  }'
```

### Response

**Success (201)**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued"
}
```

**Note**: Response immediate. Evaluation berjalan di background via queue.

**Error Responses**:

**400 Bad Request** - Invalid parameters:
```json
{
  "errors": [
    {
      "field": "cv_document_id",
      "message": "Document not found"
    }
  ]
}
```

**422 Unprocessable Entity** - Validation error:
```json
{
  "errors": [
    {
      "field": "job_title",
      "message": "Job title is required"
    }
  ]
}
```

---

## 5. Get Evaluation Result

Check status dan result dari evaluation job.

### Endpoint
```
GET /result/:id
```

### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | String (UUID) | Job ID dari evaluate response |

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `include_metadata` | Boolean | No | Include full JSON metadata dari LLM (default: false) |

### Request

**Example Request**:
```bash
# Basic request
curl http://localhost:3333/result/a1b2c3d4-e5f6-7890-abcd-ef1234567890

# With metadata
curl "http://localhost:3333/result/a1b2c3d4-e5f6-7890-abcd-ef1234567890?include_metadata=true"
```

### Response

**Status: Queued (200)**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued",
  "job_title": "Backend Developer",
  "created_at": "2024-10-23T14:30:00.000Z"
}
```

**Status: Processing (200)**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "processing",
  "job_title": "Backend Developer",
  "created_at": "2024-10-23T14:30:00.000Z",
  "started_at": "2024-10-23T14:30:05.000Z"
}
```

**Status: Completed (200)**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "job_title": "Backend Developer",
  "result": {
    "cv_match_rate": 0.82,
    "cv_feedback": "Candidate demonstrates strong technical skills with 5+ years of backend development experience using Node.js, Python, and PostgreSQL. Good exposure to cloud platforms (AWS) and API design. Experience level aligns well with senior positions. Achievements show measurable impact in previous roles with performance optimization and system scaling. Communication skills evident from leadership roles mentioned. Overall strong match for Backend Developer position.",
    "project_score": 4.5,
    "project_feedback": "Excellent implementation of the requirements. Code demonstrates proper LLM chaining with clear separation of concerns. RAG implementation using pgvector shows thoughtful design choices. Strong error handling with retry mechanisms and exponential backoff. Rate limiting implemented to manage API quotas effectively. Documentation is clear and comprehensive. Minor areas for improvement: could add unit tests for critical services and consider caching for parsed CV results. Overall, high-quality deliverable that meets and exceeds expectations."
  },
  "overall_summary": "Strong candidate with solid technical foundation and proven ability to deliver complex AI-integrated systems. The CV shows extensive backend experience that aligns well with job requirements. The project deliverable demonstrates excellent understanding of LLM workflows, RAG implementation, and production-ready error handling. Candidate shows attention to detail in both code quality and documentation. Recommended for hire.\n\nRecommendation: Hire",
  "created_at": "2024-10-23T14:30:00.000Z",
  "started_at": "2024-10-23T14:30:05.000Z",
  "completed_at": "2024-10-23T14:30:28.000Z"
}
```

**Status: Failed (200)**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "failed",
  "job_title": "Backend Developer",
  "error_message": "Failed to generate content after 3 attempts: API rate limit exceeded",
  "retry_count": 3,
  "created_at": "2024-10-23T14:30:00.000Z",
  "started_at": "2024-10-23T14:30:05.000Z"
}
```

**With Metadata (include_metadata=true)**:
```json
{
  "id": "a1b2c3d4-...",
  "status": "completed",
  "result": {
    "cv_match_rate": 0.82,
    "cv_feedback": "...",
    "project_score": 4.5,
    "project_feedback": "..."
  },
  "overall_summary": "...",
  "metadata": {
    "parsed_cv": {
      "name": "John Doe",
      "email": "john@example.com",
      "skills": ["Node.js", "PostgreSQL", "Docker"],
      "experience": [...]
    },
    "cv_evaluation": {
      "technical_skills": 4.5,
      "experience_level": 4.0,
      "achievements": 4.0,
      "cultural_fit": 4.5,
      "detailed_breakdown": "..."
    },
    "project_evaluation": {
      "correctness": 4.5,
      "code_quality": 4.0,
      "resilience": 4.5,
      "documentation": 4.5,
      "creativity": 3.5,
      "detailed_breakdown": "..."
    }
  }
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "message": "Evaluation job not found"
}
```

---

## 6. List All Evaluations

Get list of all evaluation jobs (with pagination).

### Endpoint
```
GET /evaluations
```

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | Integer | 1 | Page number |
| `limit` | Integer | 50 | Items per page (max 100) |
| `status` | String | - | Filter by status: `queued`, `processing`, `completed`, `failed` |

### Request

**Example Request**:
```bash
# Get all evaluations
curl http://localhost:3333/evaluations

# With filters
curl "http://localhost:3333/evaluations?status=completed&limit=10"
```

### Response

**Success (200)**:
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "completed",
      "job_title": "Backend Developer",
      "cv_match_rate": 0.82,
      "project_score": 4.5,
      "created_at": "2024-10-23T14:30:00.000Z",
      "completed_at": "2024-10-23T14:30:28.000Z"
    },
    {
      "id": "b2c3d4e5-f6g7-8901-bcde-fg2345678901",
      "status": "processing",
      "job_title": "Senior Backend Developer",
      "cv_match_rate": null,
      "project_score": null,
      "created_at": "2024-10-23T14:35:00.000Z",
      "completed_at": null
    }
  ],
  "meta": {
    "total": 42,
    "per_page": 50,
    "current_page": 1,
    "last_page": 1
  }
}
```

---

## Rate Limits

**Current Limits** (berdasarkan Gemini free tier):
- 15 requests per minute (RPM)
- 1000 requests per day (RPD)

**Implementation**: Client-side throttling 5 detik antar request (12 RPM safe margin).

**Response Headers**:
```
X-RateLimit-Limit: 15
X-RateLimit-Remaining: 12
X-RateLimit-Reset: 1698765432
```

**Error Response (429 Too Many Requests)**:
```json
{
  "message": "Rate limit exceeded. Please try again later.",
  "retry_after": 60
}
```

---

## Error Codes Summary

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created (evaluation started) |
| 400 | Bad Request (invalid parameters) |
| 404 | Not Found (resource tidak ditemukan) |
| 409 | Conflict (resource conflict) |
| 413 | Payload Too Large (file terlalu besar) |
| 422 | Unprocessable Entity (validation error) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (temporary) |

---

## Postman Collection

Import Postman collection untuk testing:

[Download CV Analysis API.postman_collection.json](#)

---

**Next**: [Request/Response Examples](./examples.md) | [Error Codes Detail](./error-codes.md)

