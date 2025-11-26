# WhatsApp Client Flow Update: Site Information Collection

## Overview
Updated the WhatsApp client service request flow to collect site-specific information (company name, onsite contact, and site address) after video upload and before preferred contact date selection.

## Changes Made

### 1. Flow Steps Updated (8 Total Steps)

**Previous Flow (5 steps):**
1. Container Selection
2. Error Code
3. Issue Description
4. Photo Upload
5. Video Upload → **Direct to Preferred Contact Date**

**New Flow (8 steps):**
1. Container Selection
2. Error Code
3. Issue Description
4. Photo Upload
5. Video Upload
6. **Company Name** ← NEW
7. **Onsite Contact** ← NEW
8. **Site Address** ← NEW
9. Preferred Contact Date

### 2. Progress Indicators Updated

Updated `getProgressIndicator()` function to reflect 8 total steps:
```typescript
const steps: Record<string, { current: number; total: number; emoji: string; title: string }> = {
  'awaiting_container_number': { current: 1, total: 8, emoji: '📦', title: 'Container Selection' },
  'awaiting_error_code': { current: 2, total: 8, emoji: '⚠️', title: 'Error Code' },
  'awaiting_description': { current: 3, total: 8, emoji: '📝', title: 'Issue Description' },
  'awaiting_photos': { current: 4, total: 8, emoji: '📸', title: 'Photo Upload' },
  'awaiting_videos': { current: 5, total: 8, emoji: '🎥', title: 'Video Upload' },
  'awaiting_company_name': { current: 6, total: 8, emoji: '🏢', title: 'Company Name' },
  'awaiting_onsite_contact': { current: 7, total: 8, emoji: '📞', title: 'Onsite Contact' },
  'awaiting_site_address': { current: 8, total: 8, emoji: '📍', title: 'Site Address' }
};
```

### 3. New Conversation Steps

#### Step 6: Company Name (`awaiting_company_name`)
**Trigger:** After user types "DONE" following video upload

**Message:**
```
🏢 Step 6/8: Company Name
▓▓▓▓▓▓░░

🏢 What's the company name at the site?

Please provide the full company name.
```

**Validation:** Non-empty text required

**Storage:** Saved as `companyName` in conversation state

---

#### Step 7: Onsite Contact (`awaiting_onsite_contact`)
**Trigger:** After company name is provided

**Message:**
```
📞 Step 7/8: Onsite Contact
▓▓▓▓▓▓▓░

📞 Onsite contact phone number?

This is the person/technician at the site. Can be your number: [user's number]
```

**Validation:** Non-empty text required

**Storage:** Saved as `onsiteContact` in conversation state

---

#### Step 8: Site Address (`awaiting_site_address`)
**Trigger:** After onsite contact is provided

**Message:**
```
📍 Step 8/8: Site Address
▓▓▓▓▓▓▓▓

📍 Site address (street, city, landmarks)?

Full address helps us route the technician accurately.
```

**Validation:** Non-empty text required

**Storage:** Saved as `siteAddress` in conversation state

**Next:** Proceeds to Preferred Contact Date selection

### 4. Service Request Description Enhancement

The collected site information is now included in the service request description:

```typescript
// Add site information
if (companyName) {
  fullDescription += `\n\n🏢 Company Name: ${companyName}`;
}
if (onsiteContact) {
  fullDescription += `\n📞 Onsite Contact: ${onsiteContact}`;
}
if (siteAddress) {
  fullDescription += `\n📍 Site Address: ${siteAddress}`;
}
```

**Example Service Request Description:**
```
Container cooling issue detected

Error Code: E407

🏢 Company Name: Tata Advanced Systems Ltd
📞 Onsite Contact: 918218994855
📍 Site Address: Industrial Area, Sector 5, Kolkata

☎️ Preferred Technician Call: Sat, 22 Nov
```

### 5. Error Code Reference Videos Updated

**Previous:** Single generic error video

**New:** Three specific instructional videos for different container types:

1. **Carrier Unit**
   - URL: `https://res.cloudinary.com/dsnzo163t/video/upload/v1763700758/How_to_check_alarm_in_carrier_unit_bxqqzg.mp4`
   - Caption: "🎥 How to check alarm in Carrier unit"

2. **Thermoking MP-4000 Unit**
   - URL: `https://res.cloudinary.com/dsnzo163t/video/upload/v1/How_to_check_alaram_in_mp_4000_unit_tharmoking_njc1pe.mp4`
   - Caption: "🎥 How to check alarm in MP-4000 unit (Thermoking)"

3. **Daikin Unit**
   - URL: `https://res.cloudinary.com/dsnzo163t/video/upload/v1/How_to_check_return_temperature_supply_temperature_alarm_in_daikin_unit_nwaxew.mp4`
   - Caption: "🎥 How to check return/supply temperature alarm in Daikin unit"

**Implementation:**
```typescript
// Send reference videos to help client identify error codes
await sendTextMessage(
  from,
  `🎥 *Reference Videos:*\nHere are helpful videos showing where to find error codes on different container types:`
);

// Video 1: Carrier Unit
await sendVideoMessage(from, carrierVideoUrl, carrierCaption);

// Video 2: Thermoking MP-4000 Unit
await sendVideoMessage(from, thermokingVideoUrl, thermokingCaption);

// Video 3: Daikin Unit
await sendVideoMessage(from, daikinVideoUrl, daikinCaption);
```

## Technical Implementation

### Files Modified
- `server/services/whatsapp.ts`

### Key Functions Updated
1. `getProgressIndicator()` - Updated step counts and added new steps
2. `handleClientTextMessage()` - Added handlers for new conversation steps
3. `createServiceRequestFromWhatsApp()` - Added site info to description
4. Error code video sending logic - Replaced single video with three videos

### Conversation State Schema
```typescript
interface ConversationState {
  // ... existing fields
  companyName?: string;        // NEW
  onsiteContact?: string;       // NEW
  siteAddress?: string;         // NEW
}
```

## User Experience Flow

### Complete Flow Example:

1. **User:** Types "hi"
2. **Bot:** Shows menu with "Request Service" button
3. **User:** Clicks "Request Service"
4. **Bot:** "Enter container number"
5. **User:** "CZZU6009100"
6. **Bot:** Shows "Add More" / "Proceed" buttons + sends 3 reference videos
7. **User:** Clicks "Proceed"
8. **Bot:** "What error code are you seeing?"
9. **User:** "E407"
10. **Bot:** "Describe the issue"
11. **User:** "Container not cooling properly"
12. **Bot:** "Send photos"
13. **User:** Uploads 2 photos
14. **User:** Types "DONE"
15. **Bot:** "Send videos (optional)"
16. **User:** Uploads 1 video
17. **User:** Types "DONE"
18. **Bot:** "What's the company name at the site?" ← NEW
19. **User:** "Tata Advanced Systems Ltd"
20. **Bot:** "Onsite contact phone number?" ← NEW
21. **User:** "3444545675"
22. **Bot:** "Site address?" ← NEW
23. **User:** "Kolkata"
24. **Bot:** Shows preferred contact date selection
25. **User:** Selects date
26. **Bot:** Creates service request with all information

## Benefits

### 1. Better Technician Routing
- Exact site address helps dispatch the nearest technician
- Reduces technician travel time and improves response time

### 2. Improved Communication
- Onsite contact ensures technician can reach the right person
- Company name helps verify the service location

### 3. Enhanced Service Request Quality
- All critical information collected upfront
- Reduces back-and-forth communication
- Technicians arrive fully prepared

### 4. Better Error Code Guidance
- Three specific videos for different container types
- Users can identify error codes more accurately
- Reduces incorrect error code submissions

## Backward Compatibility

✅ **Preserved Features:**
- Technician flow unchanged
- Dashboard functionality unchanged
- Admin features unchanged
- Container validation logic unchanged
- Multi-container selection unchanged
- CANCEL/RESTART commands still work
- All existing error handling preserved

## Testing Scenarios

### Test Case 1: Complete Flow with All Fields
1. Start service request
2. Select container
3. Enter error code
4. Provide description
5. Upload photos
6. Upload videos
7. Enter company name
8. Enter onsite contact
9. Enter site address
10. Select preferred date
11. ✅ Verify service request created with all fields

### Test Case 2: Skip Videos
1. Complete steps 1-5 (photos)
2. Type "DONE" without uploading videos
3. ✅ Should still ask for company name

### Test Case 3: Error Code Videos
1. Select container and click "Proceed"
2. ✅ Verify 3 videos are sent (Carrier, Thermoking, Daikin)

### Test Case 4: Empty Field Validation
1. Reach company name step
2. Send empty message
3. ✅ Should show error: "❌ Please provide the company name."

### Test Case 5: Multiple Containers
1. Add 2 containers
2. Complete full flow
3. ✅ Service request should include both containers + site info

## Database Schema

No database schema changes required. Site information is stored in the service request's `issueDescription` field as formatted text.

## Future Enhancements

### Potential Improvements:
1. **Separate Database Fields:** Create dedicated columns for `companyName`, `onsiteContact`, `siteAddress`
2. **Address Validation:** Integrate with Google Maps API for address verification
3. **Contact Validation:** Verify phone number format
4. **Auto-fill:** Pre-populate company name from container's customer record
5. **Location Sharing:** Allow users to share live location instead of typing address

## Deployment Notes

### Pre-deployment Checklist:
- ✅ Code changes committed
- ✅ Documentation updated
- ✅ No breaking changes to existing flows
- ✅ Error handling in place
- ✅ Video URLs tested and accessible

### Post-deployment Verification:
1. Test complete service request flow
2. Verify all 3 videos are sent correctly
3. Check service request description includes site info
4. Verify step indicators show "Step X/8"
5. Test CANCEL command still works
6. Verify technician flow unaffected

## Support

If users encounter issues:
1. Type **CANCEL** to exit current flow
2. Type **hi** to restart
3. Contact support: +917021307474

---

**Implementation Date:** November 21, 2025
**Version:** 2.0
**Status:** ✅ Completed
