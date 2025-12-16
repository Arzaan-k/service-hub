# Technician Document Submission System - Setup Guide

## ✅ What's Been Implemented

### Backend (Completed)
1. ✅ Database migration: `migrations/20251211_add_technician_documents.sql`
2. ✅ Schema updates: `shared/schema.ts`
3. ✅ Storage methods: `server/storage.ts`
4. ✅ Document service: `server/services/technicianDocuments.ts`
5. ✅ API routes: `server/routes/technicianDocumentRoutes.ts`

### Frontend (Completed)
1. ✅ Password setup page: `client/src/pages/technician/setup-password.tsx`
2. ✅ Document submission page: `client/src/pages/technician/submit-documents.tsx`

## 🔧 Setup Instructions

### Step 1: Run Database Migration

```bash
# Connect to your PostgreSQL database and run:
psql -U your_username -d your_database -f migrations/20251211_add_technician_documents.sql
```

Or if using Drizzle:
```bash
npm run db:push
```

### Step 2: Install Required Dependencies

```bash
# Backend dependencies (if not already installed)
npm install multer cloudinary jsonwebtoken bcryptjs

# Types
npm install --save-dev @types/multer @types/jsonwebtoken @types/bcryptjs
```

### Step 3: Configure Environment Variables

Add to your `.env` file:

```env
# Cloudinary Configuration (for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# JWT Secret (if not already set)
JWT_SECRET=your_secret_key_here

# Frontend URL (for email links)
CLIENT_URL=http://localhost:5000

# Email Configuration (should already be set)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Step 4: Integrate Routes into Main Routes File

Add to `server/routes.ts`:

```typescript
// Import at the top
import technicianDocumentRoutes from './routes/technicianDocumentRoutes';
import { sendPasswordSetupEmail } from './services/technicianDocuments';

// Add routes (after other route definitions)
app.use('/api', technicianDocumentRoutes);
```

### Step 5: Update Technician Creation to Send Password Setup Email

In `server/routes.ts`, find the technician creation endpoint (`app.post("/api/technicians", ...)`) and add after technician is created:

```typescript
// After technician creation (around line 4500)
if (user.email && !isExistingUser) {
  try {
    await sendPasswordSetupEmail(technician.id);
    console.log(`[TECHNICIAN CREATION] ✅ Password setup email sent to ${user.email}`);
  } catch (error) {
    console.error('[TECHNICIAN CREATION] ⚠️ Failed to send password setup email:', error);
  }
}
```

### Step 6: Add Frontend Routes

Add to `client/src/App.tsx` or your routing configuration:

```typescript
import SetupPasswordPage from './pages/technician/setup-password';
import SubmitDocumentsPage from './pages/technician/submit-documents';

// Add routes
<Route path="/technician/setup-password" element={<SetupPasswordPage />} />
<Route path="/technician/submit-documents" element={<SubmitDocumentsPage />} />
```

### Step 7: Create Technician Authentication Middleware (Optional)

If you want separate technician authentication, create `server/middleware/technicianAuth.ts`:

```typescript
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function authenticateTechnician(req: any, res: any, next: any) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await storage.getUser(decoded.id);
    
    if (!user || user.role !== 'technician') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const technician = await storage.getTechnicianByUserId(user.id);
    req.user = user;
    req.technician = technician;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}
```

## 📋 Remaining Frontend Components to Build

### 1. Technician Profile Page with Documents View

Create `client/src/pages/technician/profile.tsx`:
- Show technician info
- Display uploaded documents
- Allow viewing/downloading documents
- Button to upload/update documents

### 2. Document Reminder Component

Create `client/src/components/technician/DocumentReminder.tsx`:
- Show banner if documents incomplete
- Display progress (X/4 documents)
- Link to upload page
- Dismissible (but reappears until complete)

### 3. Admin Technician Documents View

Create `client/src/components/admin/TechnicianDocuments.tsx`:
- View all technician documents
- Download documents
- See document status
- Send reminders

### 4. Update Admin Technician Management

Update existing technician management page to show:
- Document status badge (X/4)
- "View Documents" button
- "Send Reminder" button

## 🧪 Testing Checklist

### Backend Testing
- [ ] Run migration successfully
- [ ] Create new technician via API
- [ ] Verify password setup email sent
- [ ] Test token verification endpoint
- [ ] Test password setup endpoint
- [ ] Test document upload endpoint
- [ ] Test document retrieval endpoints
- [ ] Test admin document viewing
- [ ] Test bulk reminder sending

### Frontend Testing
- [ ] Password setup page loads correctly
- [ ] Token verification works
- [ ] Password creation works
- [ ] Auto-login after password setup
- [ ] Document upload page loads
- [ ] File upload works (all formats)
- [ ] File size validation works
- [ ] Document submission works
- [ ] Navigation to dashboard works

### Integration Testing
- [ ] Complete flow: Create technician → Email → Setup password → Upload docs
- [ ] Existing technician can upload documents
- [ ] Admin can view technician documents
- [ ] Document reminders work
- [ ] Dashboard shows reminder if incomplete

## 🔒 Security Checklist

- [ ] Password setup tokens expire in 24 hours
- [ ] Tokens are unique and cryptographically secure
- [ ] Passwords are hashed with bcrypt
- [ ] File uploads are validated (type and size)
- [ ] Only technicians can access their own documents
- [ ] Only admins can view all documents
- [ ] JWT tokens are properly validated
- [ ] File URLs are secure (Cloudinary)

## 📊 Database Schema

### Technicians Table (Updated)
```sql
ALTER TABLE technicians ADD COLUMN:
- password_setup_token VARCHAR(255)
- password_setup_token_expiry TIMESTAMP
- documents_submitted BOOLEAN DEFAULT false
```

### Technician Documents Table (New)
```sql
CREATE TABLE technician_documents (
  id VARCHAR(255) PRIMARY KEY,
  technician_id VARCHAR(255) REFERENCES technicians(id),
  document_type VARCHAR(100) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(technician_id, document_type)
);
```

## 🎯 API Endpoints

### Public Endpoints
- `GET /api/technician/verify-setup-token/:token` - Verify password setup token
- `POST /api/technician/setup-password` - Setup password

### Technician Endpoints (Requires Auth)
- `GET /api/technician/documents-status` - Get own document status
- `GET /api/technician/my-documents` - Get own documents
- `POST /api/technician/upload-document` - Upload a document
- `POST /api/technician/submit-documents` - Mark documents as submitted

### Admin Endpoints (Requires Admin Role)
- `GET /api/technicians/:id/documents` - View technician documents
- `GET /api/technicians/:id/documents-status` - Get technician document status
- `GET /api/technicians/list-with-documents` - Get all technicians with status
- `POST /api/technicians/:id/send-document-reminder` - Send reminder to one
- `POST /api/technicians/send-document-reminders` - Send bulk reminders

## 🚀 Deployment Notes

1. **Cloudinary Setup**: Create account at cloudinary.com and get credentials
2. **Email Configuration**: Ensure email service is working for password setup emails
3. **Environment Variables**: Set all required env vars in production
4. **Database Migration**: Run migration on production database
5. **File Storage**: Ensure Cloudinary has sufficient storage quota
6. **Monitoring**: Set up logging for document uploads and email sending

## 📝 Usage Flow

### For New Technicians
1. Admin creates technician account
2. System sends password setup email
3. Technician clicks link in email
4. Technician creates password
5. System auto-logs in technician
6. Technician uploads 4 required documents
7. Technician can access dashboard

### For Existing Technicians
1. Dashboard shows reminder banner
2. Technician clicks "Upload Documents"
3. Uploads 4 required documents
4. Banner disappears when complete

### For Admins
1. View all technicians with document status
2. Click technician to view their documents
3. Download documents if needed
4. Send reminders to incomplete technicians

## 🐛 Troubleshooting

### Email Not Sending
- Check EMAIL_USER and EMAIL_PASS in .env
- Verify Gmail app password is correct
- Check email service logs

### File Upload Failing
- Verify Cloudinary credentials
- Check file size (max 5MB)
- Verify file type (JPG, PNG, PDF only)
- Check network connectivity

### Token Expired
- Tokens expire in 24 hours
- Admin needs to resend password setup email
- Or use password reset flow

### Documents Not Showing
- Check database connection
- Verify technician_id is correct
- Check file URLs are accessible
- Verify Cloudinary URLs are public

## 📞 Support

For issues or questions:
1. Check logs in browser console and server logs
2. Verify all environment variables are set
3. Test API endpoints with Postman/curl
4. Check database for data integrity
