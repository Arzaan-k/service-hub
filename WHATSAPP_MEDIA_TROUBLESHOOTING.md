# WhatsApp Media Display Issue - Troubleshooting Guide

## Problem
Images from WhatsApp are showing "Media fetch failed" error when trying to display them in the browser.

## Root Causes

### 1. **Expired WhatsApp Media IDs**
WhatsApp media IDs expire after a period of time (typically 30 days). If the media ID is old, the Graph API will return a 404 error.

**Solution:** Media needs to be downloaded and stored permanently when received, not just storing the media ID.

### 2. **Invalid or Expired Access Token**
The `CLOUD_API_ACCESS_TOKEN` may be invalid or expired.

**Check:**
```bash
# Check if token is set
grep CLOUD_API_ACCESS_TOKEN .env

# Test token validity
curl -X GET "https://graph.facebook.com/v20.0/me" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. **Incorrect Media ID Format**
Media IDs should be in the format returned by WhatsApp API (numeric string).

### 4. **Network/Firewall Issues**
The server might not be able to reach Facebook's Graph API.

## Solution 1: Enhanced Logging (Already Implemented)

I've added detailed logging to the media proxy endpoint. Check server console when accessing an image:

```
[Media Proxy] Request for ref: wa:1234567890
[Media Proxy] Extracted mediaId: 1234567890
[Media Proxy] Using Graph API version: v20.0
[Media Proxy] Fetching metadata from: https://graph.facebook.com/v20.0/1234567890
[Media Proxy] Error details:
  Status: 404
  Data: { error: { message: "Media not found", code: 404 } }
```

## Solution 2: Permanent Media Storage

The best solution is to download and store media permanently when received, instead of relying on temporary WhatsApp media IDs.

### Implementation:

#### 1. Create uploads directory:
```bash
mkdir -p uploads/whatsapp
chmod 755 uploads/whatsapp
```

#### 2. Update webhook handler to download media immediately:

```typescript
// In server/services/whatsapp.ts - handleWebhook()

if (message.type === 'image' || message.type === 'video') {
  const mediaId = message.image?.id || message.video?.id;

  if (mediaId) {
    try {
      // Download media immediately
      const mediaBuffer = await downloadWhatsAppMedia(mediaId);

      // Save to disk
      const filename = `${Date.now()}_${mediaId}.${message.type === 'image' ? 'jpg' : 'mp4'}`;
      const filepath = path.join('uploads/whatsapp', filename);
      await fs.promises.writeFile(filepath, mediaBuffer);

      // Store local path instead of media ID
      clientUploadedPhotos: [filename] // or clientUploadedVideos
    } catch (error) {
      console.error('Failed to download media:', error);
      // Fallback to storing media ID
      clientUploadedPhotos: [mediaId]
    }
  }
}
```

#### 3. Add media download function:

```typescript
async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
  const axios = (await import('axios')).default;

  // Step 1: Get media URL
  const metaUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`;
  const metaResp = await axios.get(metaUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
  });

  const directUrl = metaResp.data?.url;
  if (!directUrl) throw new Error('No media URL');

  // Step 2: Download binary
  const binResp = await axios.get(directUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    responseType: 'arraybuffer'
  });

  return Buffer.from(binResp.data);
}
```

#### 4. Serve local files:

```typescript
// In server/routes.ts

app.get("/uploads/whatsapp/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../uploads/whatsapp', filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).send("File not found");
  }

  res.sendFile(filepath);
});
```

#### 5. Update frontend to handle both formats:

```typescript
// In client/src/pages/service-request-detail.tsx

const getMediaUrl = (ref: string) => {
  if (!ref) return '';

  // If it's a local file (new format)
  if (ref.includes('_')) {
    return `/uploads/whatsapp/${ref}`;
  }

  // If it's a WhatsApp media ID (old format - may not work)
  if (ref.startsWith('wa:')) {
    return `/api/whatsapp/media/${encodeURIComponent(ref)}`;
  }

  return `/api/whatsapp/media/${encodeURIComponent(ref)}`;
};

// Usage:
<img src={getMediaUrl(photo)} alt="..." />
```

## Solution 3: Temporary Fix - Check Token

Run this test script to verify your WhatsApp token:

```bash
# Create test script
cat > test-whatsapp-token.sh <<'SCRIPT'
#!/bin/bash
source .env
echo "Testing WhatsApp token..."
curl -X GET "https://graph.facebook.com/v20.0/me" \
  -H "Authorization: Bearer $CLOUD_API_ACCESS_TOKEN"
SCRIPT

chmod +x test-whatsapp-token.sh
./test-whatsapp-token.sh
```

## Solution 4: Manual Media Migration

For existing media IDs that haven't expired yet:

```typescript
// Run this script once to download all existing media

async function migrateExistingMedia() {
  const serviceRequests = await storage.getAllServiceRequests();

  for (const req of serviceRequests) {
    // Migrate before photos
    if (req.beforePhotos?.length) {
      const newPhotos = await Promise.all(
        req.beforePhotos.map(async (mediaId) => {
          if (mediaId.includes('_')) return mediaId; // Already migrated

          try {
            const buffer = await downloadWhatsAppMedia(mediaId);
            const filename = `${Date.now()}_${mediaId}.jpg`;
            await fs.promises.writeFile(`uploads/whatsapp/${filename}`, buffer);
            return filename;
          } catch (error) {
            console.error(`Failed to migrate ${mediaId}:`, error);
            return mediaId; // Keep old ID if migration fails
          }
        })
      );

      await storage.updateServiceRequest(req.id, { beforePhotos: newPhotos });
    }

    // Same for afterPhotos, clientUploadedPhotos, clientUploadedVideos
  }
}
```

## Quick Diagnosis

1. **Check server logs** when you try to view an image:
   - Look for `[Media Proxy]` logs
   - Check the error status (401 = bad token, 404 = expired media)

2. **Check media ID format** in database:
   ```sql
   SELECT id, before_photos, after_photos, client_uploaded_photos
   FROM service_requests
   WHERE before_photos IS NOT NULL OR after_photos IS NOT NULL
   LIMIT 5;
   ```

3. **Test a specific media ID manually**:
   ```bash
   # Get metadata
   curl "https://graph.facebook.com/v20.0/YOUR_MEDIA_ID" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Recommended Action

**Implement Solution 2 (Permanent Media Storage)** - This is the only reliable long-term solution. WhatsApp media IDs are temporary and WILL expire.

The proxy endpoint should only be used as a fallback for old data, not as the primary media serving method.

---

## ✅ FIX COMPLETED - December 4, 2025

**Permanent media storage has been implemented!**

All media uploads now:
- Download immediately from WhatsApp API
- Convert to base64 data URIs
- Store permanently in database
- Display reliably without expiration

See [WHATSAPP_MEDIA_FIX_COMPLETE.md](./WHATSAPP_MEDIA_FIX_COMPLETE.md) for implementation details.

---

**Status:** ✅ FIXED - Permanent storage implemented
**Created:** December 4, 2025
**Completed:** December 4, 2025
