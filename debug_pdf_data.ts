import { db } from './server/db';
import { serviceRequests, whatsappMessages } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function run() {
    const ref = 'SR-1764151385298986'; // From screenshot
    console.log(`Searching for ${ref}...`);
    
    const reqs = await db.select().from(serviceRequests).where(eq(serviceRequests.requestNumber, ref));
    if (reqs.length === 0) {
        console.log("Request not found");
        process.exit(1);
    }
    const req = reqs[0];
    console.log("Found Request:", req.id);
    console.log("Issue Description:", req.issueDescription);
    console.log("Client Uploaded Photos:", req.clientUploadedPhotos);
    
    if (req.clientUploadedPhotos) {
        req.clientUploadedPhotos.forEach(url => {
            console.log(`Checking photo: ${url}`);
            // Decode
            let clean = decodeURIComponent(url);
            if (clean.startsWith('/')) clean = clean.slice(1);
            
            const p1 = path.join(process.cwd(), clean);
            const p2 = path.join(process.cwd(), 'uploads', path.basename(clean));
            console.log(`Path 1: ${p1} exists? ${fs.existsSync(p1)}`);
            console.log(`Path 2: ${p2} exists? ${fs.existsSync(p2)}`);
        });
    }
    
    // Check WhatsApp
    console.log("Checking WhatsApp messages for entityId:", req.id);
    const msgs = await db.select().from(whatsappMessages).where(eq(whatsappMessages.relatedEntityId, req.id));
    console.log(`Found ${msgs.length} messages.`);
    if (msgs.length > 0) {
        console.log("Sample Message Content:", JSON.stringify(msgs[0].messageContent, null, 2));
        console.log("Sample Entity Type:", msgs[0].relatedEntityType);
    }
    
    // List uploads dir
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        console.log(`Uploads dir contains ${files.length} files. First 5:`, files.slice(0, 5));
    } else {
        console.log("Uploads dir not found at", uploadsDir);
    }
    
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
