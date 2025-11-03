# Reefer Manual Upload Guide

This guide explains how to upload the Reefer Manuals to the ContainerGenie vector database.

## What Was Fixed

The file upload system was previously disabled with a comment "For now, skip processing to test file upload". The following issues have been fixed:

1. **File Saving**: Files are now properly saved to the `uploads/manuals/` directory
2. **Database Updates**: Manual records are updated with correct file paths
3. **Processing Endpoint**: Added `/api/manuals/:id/process` endpoint to process manuals for RAG
4. **Bulk Upload Script**: Created automated script for uploading multiple manuals

## How to Upload Manuals

### Method 1: Using the Bulk Upload Script (Recommended)

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Set your admin authentication token:**
   Edit `bulk-upload-manuals.js` and replace `YOUR_ADMIN_TOKEN_HERE` with your actual admin JWT token.

3. **Run the bulk upload:**
   ```bash
   node bulk-upload-manuals.js
   ```

This will automatically:
- Upload all PDF files from `C:/Users/Arzaan Ali Khan/Downloads/Reefer Manuals/`
- Save them to the server
- Create database records
- Process them for the vector database (optional - can be enabled)

### Method 2: Upload Individual Manuals

#### Using PowerShell (Windows):
```powershell
.\upload-manual.ps1 -PdfPath "C:\Users\Arzaan Ali Khan\Downloads\Reefer Manuals\ThermoKing Mp4000 TK-61110-4-OP.pdf"
```

#### Using cURL:
```bash
curl -X POST \
  -F "file=@ThermoKing Mp4000 TK-61110-4-OP.pdf" \
  -F "name=ThermoKing Mp4000 Manual" \
  -F "version=1.0" \
  http://localhost:5000/api/manuals/upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"
```

### Method 3: Via the Web Interface

1. Go to the admin section of your ContainerGenie application
2. Use the manual upload form
3. Select a PDF file and provide a name
4. The file will be uploaded and saved automatically

## Processing for RAG (Vector Database)

After uploading, you can process manuals for the RAG system:

```bash
# Process a specific manual (replace MANUAL_ID with actual ID)
curl -X POST http://localhost:5000/api/manuals/MANUAL_ID/process \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"
```

This will:
- Extract text from the PDF
- Split into chunks
- Store in the vector database for AI queries

## Troubleshooting

### "No file uploaded" Error

This error usually means:
1. **Authentication**: Make sure you're using a valid admin JWT token
2. **File Type**: Only PDF, Word documents, and text files are allowed
3. **File Size**: Maximum 50MB per file
4. **Server**: Make sure the server is running on port 5000

### Server Not Starting

If `npm run dev` doesn't start the server:
1. Check for TypeScript errors: `npx tsc --noEmit`
2. Check environment variables in `.env`
3. Ensure all dependencies are installed: `npm install`

### Authentication Issues

1. Get an admin JWT token by logging into the application as an admin user
2. Include it in requests: `Authorization: Bearer YOUR_TOKEN_HERE`

## Files Created/Modified

### Modified Files:
- `server/routes.ts` - Fixed upload endpoint, added processing endpoint
- `server/services/ragAdapter.ts` - Added updateManual and getManual methods

### New Files:
- `bulk-upload-manuals.js` - Automated bulk upload script
- `debug-upload.js` - Debug script for testing uploads
- `upload-manual.sh` - Bash script for single uploads
- `upload-manual.ps1` - PowerShell script for single uploads
- `MANUAL_UPLOAD_README.md` - This documentation

## Manual List

The following manuals are ready for upload:
- Starcool Reefer Manual Model SCI-20-40-CA and SCU-20-40
- ThermoKing Mp4000 TK-61110-4-OP.pdf
- Thermoking MAGNUM SL mP4000 TK 548414PM
- Manual Carrier Refrigeration Models 69NT20-274, 69NT40-441, etc.
- Carrier 69NT40-561-300 to 399
- Carrier 69NT40-541-505, 508 and 509 Manual
- Daikin LXE10E-A, LXE10E100, etc.
- MP3000, MP4000, MP5000 Manuals

All files are located in: `C:/Users/Arzaan Ali Khan/Downloads/Reefer Manuals/`






