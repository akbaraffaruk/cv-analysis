# Frequently Asked Questions (FAQ)

Common questions tentang CV Analysis API.

---

## General Questions

### Q: Apa itu CV Analysis API?

**A**: Backend service yang mengotomasi screening kandidat menggunakan AI (Google Gemini) dan RAG (Retrieval Augmented Generation) untuk mengevaluasi CV dan Project Report terhadap job description dan rubric yang telah ditentukan.

---

### Q: Berapa lama waktu yang diperlukan untuk satu evaluation?

**A**: Total ~25-30 detik untuk complete evaluation (CV + Project + Final Analysis). Breakdown:
- CV Evaluation: ~8-10 detik
- Project Evaluation: ~8-10 detik
- Final Analysis: ~5-8 detik

---

### Q: Berapa banyak evaluations yang bisa dilakukan per hari?

**A**: Dengan Gemini free tier:
- **15 RPM** (requests per minute)
- **1000 RPD** (requests per day)
- ~**375 evaluations/day** (4 LLM calls per evaluation)

Dengan paid tier bisa lebih banyak.

---

## Technical Questions

### Q: Mengapa menggunakan PostgreSQL + pgvector instead of ChromaDB?

**A**: 
- ✅ Single database untuk semua data (simpler architecture)
- ✅ ACID compliance
- ✅ Production-ready dengan Neon
- ✅ Familiar untuk most developers
- ⚠️ Requires pgvector extension (easy to install)

---

### Q: Kenapa rate limiting 5 detik antar request?

**A**: 
- Gemini free tier limit: 15 RPM
- 5 detik = 12 RPM (20% safety margin)
- Prevents 503 "model overloaded" errors
- Trade-off: Stability over speed

---

### Q: Bisa menggunakan LLM lain selain Gemini?

**A**: Ya, bisa. Tapi perlu modify `app/services/llm_service.ts`:
- OpenAI GPT-4
- Anthropic Claude
- Open-source models (Llama, Mistral via Ollama)

Gemini dipilih karena free tier yang generous dan native JSON mode.

---

### Q: Apa perbedaan CV Match Rate vs Project Score?

**A**:
- **CV Match Rate**: 0.0 - 1.0 (percentage match dengan job requirements)
- **Project Score**: 1.0 - 5.0 (quality score untuk project deliverable)

CV Match Rate weighted average × 0.2, Project Score langsung weighted average.

---

## Setup & Configuration

### Q: Apakah harus menggunakan Neon untuk database?

**A**: Tidak. Bisa menggunakan:
- Local PostgreSQL
- Neon (recommended untuk dev)
- AWS RDS
- Azure PostgreSQL
- Any PostgreSQL 11+ dengan pgvector

---

### Q: Redis wajib atau optional?

**A**: **Wajib** untuk queue system. Alternatif:
- Local Redis
- Docker Redis (recommended)
- Redis Cloud
- AWS ElastiCache

---

### Q: Bisa run tanpa Docker?

**A**: Ya, bisa. Install semua dependencies manual:
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

Docker hanya mempermudah Redis setup.

---

## Usage Questions

### Q: Format document apa saja yang didukung?

**A**: Saat ini hanya **PDF**. Planned future support:
- DOCX (Microsoft Word)
- TXT (plain text)
- Image files (dengan OCR)

---

### Q: Maksimal file size untuk upload?

**A**: **10MB** per file. Configurable di validator.

---

### Q: Bisa upload multiple CVs sekaligus?

**A**: Saat ini tidak (one-by-one). Planned feature untuk batch upload.

---

### Q: Hasil evaluation bisa diexport?

**A**: Ya, response JSON bisa disave atau integrate dengan:
- PDF generator
- Email service
- Analytics dashboard

---

## Evaluation Questions

### Q: Bagaimana CV di-parse?

**A**: 
1. Extract text dari PDF menggunakan `pdf-parse`
2. LLM parse text → structured JSON (name, skills, experience, etc)
3. JSON stored di `evaluation_jobs.parsed_cv_metadata`

---

### Q: Apa itu RAG dan bagaimana cara kerjanya?

**A**: 
**RAG** = Retrieval Augmented Generation

**How it works**:
1. System documents (job descriptions, rubrics) di-ingest ke vector database
2. Saat evaluation, relevant chunks di-retrieve
3. Chunks di-inject ke LLM prompt sebagai context
4. LLM generate evaluation based on context

**Why RAG**:
- Dynamic context (bisa ganti job description tanpa retrain)
- Accurate evaluation (based on specific rubrics)
- Scalable (support banyak job positions)

---

### Q: Apakah evaluation consistent?

**A**: Ya, dengan:
- JSON mode (structured output)
- Detailed prompts dengan weights
- RAG context (ground truth)
- Temperature control (0.5-0.7)

Testing shows ±0.05 consistency untuk same input.

---

### Q: Bisa customize scoring rubric?

**A**: Ya! Update PDF files di `storage/system-documents/rubrics/`, lalu re-run:
```bash
node ace ingest:documents --clear
```

---

## Error Handling

### Q: Apa yang terjadi jika LLM request failed?

**A**: 
- Automatic retry (max 3 attempts)
- Exponential backoff (3s, 6s, 12s)
- For 503 errors: longer backoff (30s, 60s, 120s)
- After 3 failures: job marked as "failed"

---

### Q: Bisa manual retry failed job?

**A**: Saat ini tidak. Workaround:
- Re-upload documents
- Trigger new evaluation

Planned feature: manual retry via admin panel.

---

## Performance & Scaling

### Q: Bisa handle concurrent evaluations?

**A**: Ya, queue system handle concurrent requests. Jobs processed sequentially dengan rate limiting.

---

### Q: Bagaimana cara scale untuk production?

**A**: 
- Horizontal scaling: Multiple API servers + queue workers
- Database: Read replicas
- Cache layer: Redis untuk parsed CVs
- Paid LLM tier: Higher RPM limit

See [System Architecture](../architecture/system-design.md#scalability-considerations)

---

### Q: Bottleneck ada dimana?

**A**: 
1. **Rate limiting** (5s delay) - biggest bottleneck
2. LLM API latency (~2-3s per request)
3. Embedding generation (during ingestion only)

**Solutions**: Paid tier, caching, batch processing.

---

## Security & Privacy

### Q: Apakah data kandidat aman?

**A**: 
- PDF stored locally di `storage/uploads/`
- Database connection encrypted (SSL)
- No data sent to 3rd party except LLM API (Gemini)

**Recommendations untuk production**:
- Add authentication
- Encrypt PDFs at rest
- GDPR compliance (data retention policy)

---

### Q: Apakah ada authentication?

**A**: Belum implemented (MVP focus). Planned:
- JWT tokens
- API keys
- Role-based access control (RBAC)

---

## Deployment

### Q: Bisa deploy ke Vercel/Netlify?

**A**: Tidak recommended. Need:
- Long-running processes (queue worker)
- PostgreSQL + Redis
- File storage

**Recommended platforms**:
- Heroku
- Railway
- DigitalOcean
- AWS/GCP/Azure

---

### Q: Estimasi hosting cost?

**A**: 
**Free tier** (development):
- Neon PostgreSQL: Free
- Redis Cloud: Free (30MB)
- Gemini API: Free (15 RPM)
- Total: **$0/month**

**Production** (estimated):
- PostgreSQL: $25/month
- Redis: $10/month
- Server: $20/month
- LLM API (paid): $50/month
- Total: **~$105/month**

---

## Troubleshooting

### Q: Dimana saya bisa lihat logs?

**A**: 
- API server: Terminal running `pnpm dev`
- Queue worker: Terminal running `node ace queue:listen`
- Database: PostgreSQL logs
- Redis: Redis logs

---

### Q: Job stuck di "processing", apa yang harus dilakukan?

**A**: 
1. Check queue worker running
2. Check queue worker logs untuk errors
3. Check Redis connection
4. Manual check database: `SELECT * FROM evaluation_jobs WHERE status = 'processing'`

See [Common Issues](./common-issues.md#evaluation-issues)

---

## Contributing

### Q: Bisa contribute ke project ini?

**A**: Ya! (if open source)
1. Fork repository
2. Create feature branch
3. Make changes
4. Submit pull request

---

### Q: Bagaimana cara report bug?

**A**: 
Create issue di GitHub dengan:
- Error message lengkap
- Steps to reproduce
- Environment details
- Relevant logs

---

**Still have questions?** Check [Common Issues](./common-issues.md) atau create an issue.

