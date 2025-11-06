# Reefer Diagnostic Assistant (RAG-based)

## Overview

The Reefer Diagnostic Assistant is an AI-powered chatbot integrated into ContainerGenie that helps users troubleshoot container issues using Retrieval-Augmented Generation (RAG) technology. It provides intelligent responses based on service manuals and historical data.

## Features

### 🤖 Intelligent Chat Interface
- **Context-aware responses** - Understands alarm codes and container models
- **Structured troubleshooting** - Step-by-step repair procedures
- **Source citations** - References to specific manual pages
- **Confidence indicators** - High/Medium/Low confidence levels
- **Suggested parts** - AI-recommended spare components

### 🔧 Alert Integration
- **Expandable help** - "Get Help" button on every alert
- **Context passing** - Automatic alarm code and container info
- **Real-time assistance** - Immediate troubleshooting guidance

### 📚 Admin Manual Management
- **Manual upload** - Admin interface for service manual management
- **Metadata support** - Brand, model, alarm codes, and component info
- **Version control** - Track manual versions and updates

### 📊 Analytics & History
- **Query tracking** - Complete audit trail of all questions
- **Usage statistics** - Popular queries and response effectiveness
- **Container-specific history** - Per-container diagnostic history

## Setup Instructions

### 1. Complete RAG System Setup

The RAG system is now fully implemented with **FREE AI alternatives** - no OpenAI costs! Follow these steps to set up the complete system:

```bash
# 1. Install dependencies (already done if following this guide)
npm install

# 2. Set up environment variables in .env
NVIDIA_API_KEY=your_nvidia_api_key_here  # Get from https://build.nvidia.com/explore/discover
OPENAI_API_KEY=your_openai_api_key_here  # Optional: for enhanced reranking
CHROMA_URL=http://localhost:8000         # Optional, defaults to localhost:8000

# 3. Run the complete RAG setup
npm run setup:rag:full

# 4. Check system health
npm run check:rag

# 5. Apply Database Migration

Apply the pgvector migration to enable vector storage in your Neon database:

```sql
-- Run this SQL in your Neon dashboard or via migration
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE manual_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);
CREATE INDEX IF NOT EXISTS manual_chunks_embedding_idx ON manual_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

Or use the provided migration file: `migrations/add_pgvector_support.sql`

# 6. Start the application
npm run dev
```

## 🎉 **COMPLETELY FREE AI PROCESSING WITH NEON INTEGRATION**

This implementation uses:
- **FREE Embeddings**: HuggingFace all-MiniLM-L6-v2 model (local processing)
- **FREE LLM**: NVIDIA API with Llama 3 8B model (generous free tier)
- **Your Existing DB**: Neon PostgreSQL with pgvector extension

**No API costs for AI processing!** 🚀

### 2. Manual Setup Steps

If you prefer manual setup:

```bash
# Install additional dependencies (FREE alternatives)
npm install pdf-parse chromadb @xenova/transformers onnxruntime-node langchain multer

# Create upload directories
mkdir -p uploads/manuals

# Set environment variables in .env
NVIDIA_API_KEY=your_nvidia_api_key_here  # Get from https://build.nvidia.com/explore/discover

# Run database migrations (ensure RAG tables exist)
# The tables should be created via the existing migration file: migrations/add_rag_tables.sql

# Initialize vector store (will happen automatically on server start)
```

### 2. Database Schema

The RAG feature adds three new tables:

- **`manuals`** - Service manual metadata and versioning
- **`manual_chunks`** - Text chunks for vector search
- **`rag_queries`** - Chat history and analytics

### 3. Navigation Access

- **AI Assistant** - Available to all user roles (admin, coordinator, technician, client)
- **Manuals** - Admin-only section for uploading service manuals

## Usage

### For Users (All Roles)

1. **Via Sidebar Navigation**
   - Click "AI Assistant" in the sidebar
   - Start asking questions about alarms, troubleshooting, or maintenance

2. **Via Alert Integration**
   - On any alert card, click the "Get Help" button
   - Chat interface expands with alarm context pre-filled
   - Ask specific questions about the current issue

3. **Example Queries**
   - "What causes Alarm 17?"
   - "How to fix return air sensor fault?"
   - "What parts do I need for compressor replacement?"
   - "Show me the troubleshooting steps for temperature issues"

### For Admins

1. **Upload Manuals**
   - Navigate to "Manuals" in the sidebar (admin only)
   - Click "Upload New Manual"
   - Fill in metadata (name, version, source URL, additional info)
   - Submit to add to the system

2. **Manage Manuals**
   - View all uploaded manuals
   - Delete outdated versions
   - Update metadata as needed

## Technical Architecture

### Frontend Components

```
client/src/components/rag/
├── ReeferDiagnosticChat.tsx    # Main chat interface
└── ...

client/src/pages/
├── rag-chat.tsx                # Full chat page
└── admin-manual-upload.tsx     # Admin interface
```

### Backend Services

```
server/services/
├── ragAdapter.ts              # RAG service integration with FREE NVIDIA API
├── vectorStore.ts             # PostgreSQL/Neon vector storage with FREE HuggingFace embeddings
├── documentProcessor.ts       # PDF processing and text extraction
└── ...                        # Other services

server/routes.ts                # API endpoints
├── POST /api/rag/query        # Main chat endpoint (with real RAG)
├── GET /api/rag/history       # Query history
├── POST /api/alerts/:id/troubleshoot  # Alert help
├── GET /api/manuals           # List manuals
├── POST /api/manuals/upload   # Upload manual with processing
└── DELETE /api/manuals/:id    # Delete manual
```

### AI Components (100% FREE with Neon Integration)

- **Embeddings**: HuggingFace `all-MiniLM-L6-v2` (384-dim, local processing)
- **LLM**: NVIDIA API `meta/llama3-8b-instruct` (free tier available)
- **Vector DB**: Your existing Neon PostgreSQL with pgvector extension
- **Text Processing**: Local PDF parsing and chunking
- **Unified Storage**: Everything in one database

### Database Schema

```sql
-- Manuals table
CREATE TABLE manuals (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  source_url text,
  uploaded_by uuid REFERENCES users(id),
  uploaded_on timestamptz DEFAULT now(),
  version text,
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Manual chunks with vector embeddings stored in PostgreSQL
CREATE TABLE manual_chunks (
  id uuid PRIMARY KEY,
  manual_id uuid REFERENCES manuals(id),
  chunk_text text NOT NULL,
  chunk_embedding_id text,
  embedding vector(384), -- Vector embedding stored directly in PostgreSQL
  page_num integer,
  start_offset integer,
  end_offset integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient vector similarity search
CREATE INDEX manual_chunks_embedding_idx
ON manual_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Query history and analytics
CREATE TABLE rag_queries (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  unit_id uuid REFERENCES containers(id),
  query_text text NOT NULL,
  response_text text NOT NULL,
  sources jsonb,
  confidence text NOT NULL,
  suggested_parts jsonb,
  context jsonb,
  created_at timestamptz DEFAULT now()
);
```

## API Reference

### POST /api/rag/query

Main endpoint for chat queries.

**Request:**
```json
{
  "user_id": "uuid",
  "unit_id": "uuid",
  "unit_model": "Thermo King SL-500",
  "alarm_code": "Alarm 17",
  "query": "What causes Alarm 17?",
  "context": {
    "alert_id": "uuid",
    "telemetry": { "temp": 5.2 }
  }
}
```

**Response:**
```json
{
  "answer": "Alarm 17: Return air sensor fault...",
  "steps": ["1. Check wiring...", "2. Test sensor..."],
  "sources": [
    {
      "manual_id": "123",
      "manual_name": "Thermo King Service Manual",
      "page": 42
    }
  ],
  "confidence": "high",
  "suggested_spare_parts": ["Return air sensor", "Wiring harness"],
  "request_id": "uuid"
}
```

### GET /api/manuals

List all uploaded manuals (admin only).

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Thermo King SL-500 Manual",
    "version": "v2.1",
    "meta": {
      "brand": "Thermo King",
      "alarms": ["17", "23"]
    },
    "uploaded_on": "2025-01-15T10:30:00Z"
  }
]
```

## Mock Service

The current implementation includes an intelligent mock service that provides realistic responses for development and testing. This can be replaced with a full RAG service when ready.

### Mock Response Examples

- **Alarm 17**: Return air sensor troubleshooting steps
- **General queries**: Generic troubleshooting with source citations
- **Parts suggestions**: Context-aware spare part recommendations

## Security

- **Role-based access** - Different permissions for different user types
- **Audit logging** - All queries are logged for compliance
- **Data privacy** - Manual content is not logged in plaintext
- **Rate limiting** - Prevents abuse of the diagnostic service

## Performance

- **Caching** - Redis caching for frequent queries
- **Database optimization** - Proper indexing for fast lookups
- **Real-time responses** - WebSocket integration for live updates
- **Scalable architecture** - Ready for high query volumes

## Future Enhancements

### Phase 2: Full RAG Implementation

1. **Vector Database Integration**
   - Chroma or Qdrant for semantic search
   - OpenAI embeddings for high-quality matching

2. **Document Processing Pipeline**
   - PDF text extraction and chunking
   - OCR for scanned manuals
   - Table and diagram processing

3. **Advanced LLM Integration**
   - OpenAI GPT-4 for complex queries
   - Local models for on-premises deployment
   - Multi-language support

4. **Enhanced Analytics**
   - Query success rates
   - Most common issues
   - Technician performance metrics

## Testing

### Manual Testing Checklist

- [ ] Chat interface loads without errors
- [ ] Alert integration shows "Get Help" button
- [ ] Mock responses provide relevant information
- [ ] Admin can upload and manage manuals
- [ ] Query history is properly recorded
- [ ] Role-based access works correctly

### Automated Tests

Run the existing TestSprite tests to ensure no regressions:

```bash
npm test  # Run all tests
```

## Troubleshooting

### Common Issues

1. **Chat not loading**
   - Check if user is authenticated
   - Verify API endpoints are accessible
   - Check browser console for errors

2. **No responses**
   - Ensure mock service is enabled in development
   - Check if manuals are uploaded in admin section
   - Verify database connections

3. **Admin access issues**
   - Confirm user has admin or super_admin role
   - Check role-based route protection

### Debug Commands

```bash
# Check RAG queries in database
psql $DATABASE_URL -c "SELECT * FROM rag_queries ORDER BY created_at DESC LIMIT 10;"

# Check uploaded manuals
psql $DATABASE_URL -c "SELECT * FROM manuals ORDER BY uploaded_on DESC;"

# View application logs
tail -f logs/app.log
```

## Support

For technical issues or feature requests related to the RAG Diagnostic Assistant, please:

1. Check this documentation first
2. Review the browser console for error messages
3. Check the server logs for API errors
4. Contact the development team with specific error details

---

## Version History

- **v1.0** - Initial implementation with mock responses
- **v1.1** - Alert integration and admin interface
- **v2.0** - ✅ **COMPLETE RAG IMPLEMENTATION**
  - Real PDF processing and text extraction
  - **FREE HuggingFace embeddings** (all-MiniLM-L6-v2)
  - Chroma vector database storage
  - Intelligent text chunking with metadata preservation
  - **FREE NVIDIA API LLM** (Llama 3 8B) with source citations
  - Confidence scoring and part recommendations
  - Full file upload and processing pipeline
  - **💰 ZERO API COSTS for AI processing**
- **v3.0** - Advanced analytics and multi-language support (planned)

---

*This documentation covers the complete RAG Diagnostic Assistant implementation in ContainerGenie. The system now features **100% FREE AI processing** with PDF processing, HuggingFace embeddings, NVIDIA API LLM, and vector embeddings. The implementation includes comprehensive error handling and falls back to intelligent mock responses when external services are unavailable.*



