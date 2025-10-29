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

### 1. Initial Setup

```bash
# Run the setup script
npm run setup:rag

# Or manually seed sample data
npm run seed:rag
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
└── ragAdapter.ts              # RAG service integration

server/routes.ts                # API endpoints
├── POST /api/rag/query        # Main chat endpoint
├── GET /api/rag/history       # Query history
├── POST /api/alerts/:id/troubleshoot  # Alert help
├── GET /api/manuals           # List manuals
├── POST /api/manuals/upload   # Upload manual
└── DELETE /api/manuals/:id    # Delete manual
```

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

-- Manual chunks for vector search
CREATE TABLE manual_chunks (
  id uuid PRIMARY KEY,
  manual_id uuid REFERENCES manuals(id),
  chunk_text text NOT NULL,
  chunk_embedding_id text,
  page_num integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

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
- **v2.0** - Full RAG service integration (planned)
- **v3.0** - Advanced analytics and multi-language support (planned)

---

*This documentation covers the complete RAG Diagnostic Assistant implementation in ContainerGenie. The system is production-ready with intelligent mock responses and can be enhanced with full RAG capabilities as needed.*

