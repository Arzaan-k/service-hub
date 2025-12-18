# Service Hub - Feature Integration Checklist

## Purpose
This document ensures that when adding new features, existing functionality is not broken. Follow this checklist for every new feature implementation.

---

## ✅ Pre-Implementation Checklist

### 1. **Route Registration**
- [ ] Route file created in `server/routes/`
- [ ] Route imported in `server/routes.ts`
- [ ] Route registered with `app.use('/api', routerName)`
- [ ] All route paths follow consistent naming conventions

### 2. **Storage Layer Methods**
- [ ] All required storage methods are implemented in `server/storage.ts`
- [ ] Methods are properly exported from the DatabaseStorage class
- [ ] Error handling is implemented for all database operations
- [ ] Console logging added for debugging

### 3. **Frontend Routes**
- [ ] Component created in `client/src/pages/`
- [ ] Component imported in `client/src/App.tsx`
- [ ] Route added to the Router component
- [ ] Protected routes have proper role-based access control

### 4. **Authentication & Authorization**
- [ ] `authenticateUser` middleware applied where needed
- [ ] `requireRole` middleware applied for admin-only routes
- [ ] Public routes explicitly marked as public
- [ ] User permissions validated on both frontend and backend

---

## 🔍 Critical Features to Verify After Changes

### **Duplicate Container Detection**
- Backend: `getDuplicateContainerCounts()` in `storage.ts`
- Frontend: Yellow/amber backgrounds, badges, and highlighted container codes
- Test: Check service requests with duplicate container codes

### **Document Management System**
- Storage Methods:
  - `getTechnicianDocuments(technicianId)`
  - `getTechnicianDocument(documentId)`
  - `createTechnicianDocument(data)`
  - `updateTechnicianDocument(documentId, data)`
  - `deleteTechnicianDocument(documentId)`
- Routes:
  - `GET /api/technicians/documents/:id` - Serve document file
  - `POST /api/technician/upload-document` - Upload document
  - `GET /api/technician/my-documents` - Get technician's documents
  - `POST /api/technicians/:id/send-document-reminder` - Send reminder email
- Frontend:
  - `/technician/submit-documents` - Document upload page
  - `/technician/setup-password` - Password setup page
- Test: Upload, view, and download documents

### **Service Request Management**
- Methods: `getAllServiceRequests()`, `getServiceRequest(id)`, `getServiceRequestsByTechnician()`
- Ensure `isDuplicate` and `duplicateCount` fields are included
- Test: Create, view, assign, and complete service requests

### **Email Notifications**
- Service: `server/services/emailService.ts`
- Mailgun API integration
- Document reminder emails
- Test: Send test emails in development mode

### **Training Materials**
- Routes: `/api/training/*`
- File serving for training materials
- Test: Upload and view training materials

---

## 🛡️ Common Issues to Avoid

### **Issue 1: Missing Storage Methods**
**Problem:** Routes call storage methods that don't exist
**Solution:** Always implement storage methods before creating routes that use them

**Example:**
```typescript
// In storage.ts
async getTechnicianDocument(documentId: string): Promise<TechnicianDocument | undefined> {
  const [document] = await db.select().from(technicianDocuments).where(eq(technicianDocuments.id, documentId));
  return document;
}
```

### **Issue 2: Unregistered Routes**
**Problem:** Routes exist but are not registered in `routes.ts`
**Solution:** Always add `app.use('/api', routerName)` in `routes.ts`

**Example:**
```typescript
// In routes.ts
import technicianDocumentRoutes from './routes/technicianDocumentRoutes';
app.use('/api', technicianDocumentRoutes);
```

### **Issue 3: Missing Frontend Routes**
**Problem:** Backend endpoint exists but frontend route doesn't
**Solution:** Add route to `App.tsx` Router component

**Example:**
```typescript
// In App.tsx
import TechnicianSubmitDocuments from "@/pages/technician/submit-documents";
<Route path="/technician/submit-documents">
  {() => <ProtectedRoute component={TechnicianSubmitDocuments} roles={["technician"]} />}
</Route>
```

### **Issue 4: Incorrect File Serving**
**Problem:** Files return "Error serving file"
**Solution:** Ensure proper Content-Type headers and binary data handling

**Example:**
```typescript
res.setHeader('Content-Type', document.contentType || 'application/octet-stream');
res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
res.send(document.fileData);
```

### **Issue 5: Database Enum Mismatches**
**Problem:** Using status values not defined in database enum
**Solution:** Always check `shared/schema.ts` for valid enum values

**Example:**
```typescript
// Valid service_status values: ['pending', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled']
// DON'T use: 'assigned' (not in enum)
```

---

## 📝 Testing Checklist

After implementing any feature, test the following:

### **Backend Tests**
- [ ] Server starts without errors
- [ ] All API endpoints respond correctly
- [ ] Database queries execute successfully
- [ ] Error handling works as expected
- [ ] Console logs show proper debugging information

### **Frontend Tests**
- [ ] All pages load without white screens
- [ ] Navigation works correctly
- [ ] Forms submit successfully
- [ ] File uploads work
- [ ] File downloads/viewing works
- [ ] Authentication redirects work
- [ ] Role-based access control works

### **Integration Tests**
- [ ] Email sending works (check logs in dev mode)
- [ ] Document upload → storage → retrieval flow works
- [ ] Service request creation → assignment → completion flow works
- [ ] Duplicate detection displays correctly
- [ ] WhatsApp integration works (if applicable)

---

## 🔧 Quick Fix Commands

### Restart Server
```bash
taskkill /F /IM node.exe
npm run dev
```

### Check Server Logs
Look for these patterns:
- `[Storage]` - Database operations
- `[TECHNICIAN DOCUMENTS]` - Document operations
- `[REQUEST]` - HTTP requests
- `📧` - Email operations
- `✅` - Success messages
- `❌` - Error messages

### Common Debugging Steps
1. Check browser console for frontend errors
2. Check server logs for backend errors
3. Verify route is registered in `routes.ts`
4. Verify storage method exists in `storage.ts`
5. Verify frontend route exists in `App.tsx`
6. Check authentication middleware is applied
7. Verify database enum values match code

---

## 📚 Key Files Reference

### Backend
- `server/routes.ts` - Main route registration
- `server/storage.ts` - Database operations
- `server/routes/technicianDocumentRoutes.ts` - Document management
- `server/services/emailService.ts` - Email functionality
- `server/services/technicianDocuments.ts` - Document business logic
- `shared/schema.ts` - Database schema and enums

### Frontend
- `client/src/App.tsx` - Route definitions
- `client/src/pages/technician/submit-documents.tsx` - Document upload
- `client/src/pages/technician-profile.tsx` - Technician profile
- `client/src/pages/service-requests.tsx` - Service requests list
- `client/src/pages/service-request-detail.tsx` - Service request detail

---

## 🎯 Feature Status

### ✅ Implemented and Working
- Duplicate container color coding
- Document upload and management
- Document reminder emails
- Document file serving
- Service request management
- Training materials
- WhatsApp integration
- Finance tracking
- Inventory management

### 🔄 Recently Fixed
- Added `getTechnicianDocument()` method
- Added `createTechnicianDocument()` method
- Added `updateTechnicianDocument()` method
- Added `deleteTechnicianDocument()` method
- Registered technician document routes
- Added `/technician/submit-documents` frontend route
- Fixed document file serving endpoint
- Fixed duplicate detection to use container code

---

## 💡 Best Practices

1. **Always check if storage methods exist before using them**
2. **Register routes immediately after creating them**
3. **Add frontend routes when creating backend endpoints**
4. **Use consistent naming conventions**
5. **Add proper error handling and logging**
6. **Test in development before deploying**
7. **Document any new features in this file**
8. **Keep authentication middleware consistent**
9. **Validate user permissions on both frontend and backend**
10. **Use TypeScript types for better type safety**

---

## 🚨 Emergency Rollback

If a feature breaks production:

1. Identify the breaking change in git history
2. Revert the specific commit
3. Restart the server
4. Verify critical features work
5. Fix the issue in a separate branch
6. Test thoroughly before redeploying

---

**Last Updated:** December 17, 2025
**Maintained By:** Development Team
