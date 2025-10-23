# API Request/Response Examples

Contoh lengkap request dan response untuk setiap endpoint.

---

## Complete Workflow Example

### Scenario: Evaluate John Doe's Application

**Step 1: Upload Documents**

```bash
curl -X POST http://localhost:3333/upload \
  -F "cv=@john-doe-cv.pdf" \
  -F "project_report=@john-doe-project.pdf"
```

**Response**:
```json
{
  "message": "Documents uploaded successfully",
  "data": {
    "cv": {
      "id": 1,
      "type": "cv",
      "original_name": "john-doe-cv.pdf",
      "file_size": 245678,
      "created_at": "2024-10-23T14:30:00.000Z"
    },
    "project_report": {
      "id": 2,
      "type": "project_report",
      "original_name": "john-doe-project.pdf",
      "file_size": 512345,
      "created_at": "2024-10-23T14:30:01.000Z"
    }
  }
}
```

---

**Step 2: Trigger Evaluation**

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

---

**Step 3: Check Status (after 5s)**

```bash
curl http://localhost:3333/result/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "processing",
  "job_title": "Backend Developer",
  "created_at": "2024-10-23T14:30:00.000Z",
  "started_at": "2024-10-23T14:30:02.000Z"
}
```

---

**Step 4: Get Final Result (after 30s)**

```bash
curl http://localhost:3333/result/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response**:
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
  "started_at": "2024-10-23T14:30:02.000Z",
  "completed_at": "2024-10-23T14:30:28.000Z"
}
```

---

## Error Examples

### 400 Bad Request - Invalid File Type

**Request**:
```bash
curl -X POST http://localhost:3333/upload \
  -F "cv=@document.txt" \
  -F "project_report=@report.pdf"
```

**Response**:
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

---

### 404 Not Found - Document Not Found

**Request**:
```bash
curl http://localhost:3333/documents/999
```

**Response**:
```json
{
  "message": "Document not found"
}
```

---

### 422 Validation Error - Missing Required Field

**Request**:
```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "cv_document_id": 1,
    "project_document_id": 2
  }'
```

**Response**:
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

---

**See**: [API Endpoints](./endpoints.md) for complete documentation

