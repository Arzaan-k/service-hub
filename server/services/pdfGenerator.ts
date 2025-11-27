import PDFDocument from 'pdfkit';
import { storage } from '../storage';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { serviceRequests, technicians, whatsappMessages } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';

// Constants for styling
const COLORS = {
    primary: '#193782',
    secondary: '#F0F3F8',
    text: '#000000',
    textLabel: '#464664',
    border: '#C8C8C8',
    white: '#FFFFFF',
    success: '#16A34A',
    warning: '#EAB308',
    danger: '#EF4444',
    info: '#2563EB'
};

const LAYOUT = {
    margin: 40,
    width: 612,
    height: 792,
    contentWidth: 532
};

const WHATSAPP_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;

function sanitizeText(str: string) {
    if (!str) return '';
    let s = str;
    s = s.replace(/₹/g, 'Rs. ');
    s = s.replace(/…/g, '...');
    s = s.replace(/[\u2018\u2019]/g, "'");
    s = s.replace(/[\u201C\u201D]/g, '"');
    s = s.replace(/[^\x20-\x7E\n\r\t]/g, '');
    return s;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    if (!url) return null;
    
    if (url.startsWith('wa:')) {
        const mediaId = url.split(':')[1];
        if (!WHATSAPP_TOKEN) return null;
        try {
             const graphUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
             const mediaRes = await axios.get(graphUrl, {
                 headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
                 timeout: 5000
             });
             const downloadUrl = mediaRes.data.url;
             const imgRes = await axios.get(downloadUrl, {
                 responseType: 'arraybuffer',
                 headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
                 timeout: 10000
             });
             return Buffer.from(imgRes.data);
        } catch (e: any) {
            console.error('Failed to fetch WA media:', mediaId, e.message);
            return null;
        }
    }

    if (url.startsWith('http')) {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      return Buffer.from(response.data);
    } else {
        let cleanUrl = decodeURIComponent(url);
        cleanUrl = cleanUrl.replace(/\\/g, '/');
        if (cleanUrl.startsWith('/')) cleanUrl = cleanUrl.slice(1);
        const localPath = path.join(process.cwd(), cleanUrl);
        if (fs.existsSync(localPath)) {
            return fs.readFileSync(localPath);
        }
        return null; 
    }
  } catch (e) {
    return null;
  }
}

export async function generateServiceReportPDF(serviceRequestId: string, stage: string): Promise<Buffer> {
  const serviceRequest = await storage.getServiceRequest(serviceRequestId);
  if (!serviceRequest) throw new Error('Service Request not found');
  
  const customer = await storage.getCustomer(serviceRequest.customerId);
  const technician = serviceRequest.assignedTechnicianId ? await storage.getTechnician(serviceRequest.assignedTechnicianId) : null;
  const container = await storage.getContainer(serviceRequest.containerId);
  
  let technicianUser = null;
  if (technician) {
      technicianUser = await storage.getUser(technician.userId);
  }

  return new Promise(async (resolve, reject) => {
    try {
        const doc = new PDFDocument({ 
            margin: LAYOUT.margin, 
            size: 'LETTER',
            bufferPages: true,
            autoFirstPage: true
        });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        const ctx = { doc, y: 120 }; 

        // Header logic
        if (stage === 'complete') {
            drawCoverPage(ctx, serviceRequest, customer);
            doc.addPage();
            ctx.y = LAYOUT.margin + 20;
            drawHeader(doc, 'complete', serviceRequest);
            ctx.y = 120;
        } else {
            drawHeader(doc, stage, serviceRequest);
        }

        // Content logic
        if (stage === 'initial') {
            await drawInitialContent(ctx, serviceRequest, customer, container);
        } else if (stage === 'pre_service') {
            await drawInitialContent(ctx, serviceRequest, customer, container);
            await drawPreServiceDetails(ctx, serviceRequest, technician, technicianUser);
        } else if (stage === 'post_service') {
            // Post service typically includes basic info + post details
            await drawBasicInfo(ctx, serviceRequest);
            await drawPostServiceDetails(ctx, serviceRequest, technician, technicianUser);
        } else if (stage === 'complete') {
            await drawCompleteContent(ctx, serviceRequest, customer, container, technician, technicianUser);
        }

        drawFooter(doc, serviceRequest.id);
        doc.end();
    } catch (e) {
        console.error('PDF Generation Error:', e);
        reject(e);
    }
  });
}

// --- Atomic Draw Functions ---

async function drawInitialContent(ctx: any, req: any, customer: any, container: any) {
    await drawBasicInfo(ctx, req);
    await drawIssueDescription(ctx, req);
    await drawClientDetails(ctx, customer);
    await drawContainerDetails(ctx, container);
    if (req.clientUploadedPhotos && req.clientUploadedPhotos.length > 0) {
        await drawImages(ctx, 'CLIENT UPLOADED PHOTOS', req.clientUploadedPhotos);
    }
}

async function drawBasicInfo(ctx: any, req: any) {
    drawSectionHeader(ctx, 'BASIC INFORMATION');
    drawField(ctx, 'Priority', req.priority?.toUpperCase());
    drawField(ctx, 'Status', req.status?.toUpperCase());
    drawField(ctx, 'Created Date', new Date(req.requestedAt).toLocaleString());
    ctx.y += 10;
}

async function drawIssueDescription(ctx: any, req: any) {
    let descriptionText = sanitizeText(req.issueDescription || '');
    
    // Fetch WhatsApp
    try {
        const messages = await db.select().from(whatsappMessages)
           .where(eq(whatsappMessages.relatedEntityId, req.id))
           .orderBy(asc(whatsappMessages.sentAt));
           
        if (messages.length > 0) {
            const waText = messages.map(m => {
                const content = m.messageContent as any;
                const body = content.body || content.text?.body || '[Media/Other]';
                const sender = m.recipientType === 'technician' ? 'Coordinator' : 'Technician/Client'; 
                return `[${new Date(m.sentAt).toLocaleString()}] ${sender}: ${sanitizeText(body)}`;
            }).join('\n');
            
            descriptionText += `\n\n--- WHATSAPP LOG ---\n${waText}`;
        }
    } catch (e) {
        console.error("WA Fetch Error", e);
    }
    
    if (!descriptionText.trim()) descriptionText = "No issue description provided.";
    drawTextBlock(ctx, 'ISSUE DESCRIPTION', descriptionText);
    
    if (req.alertId) {
        drawField(ctx, 'Alert ID', req.alertId);
        ctx.y += 10;
    }
}

async function drawClientDetails(ctx: any, customer: any) {
    drawSectionHeader(ctx, 'CLIENT DETAILS');
    if (customer) {
        drawField(ctx, 'Company Name', customer.companyName || customer.company);
        drawField(ctx, 'Contact Person', customer.contactPerson || customer.name);
        drawField(ctx, 'Phone', customer.phone);
        drawField(ctx, 'Address', customer.billingAddress || customer.address);
    }
    ctx.y += 10;
}

async function drawContainerDetails(ctx: any, container: any) {
    drawSectionHeader(ctx, 'CONTAINER DETAILS');
    if (container) {
        drawField(ctx, 'Container Code', container.containerCode);
        drawField(ctx, 'Type', container.type);
        drawField(ctx, 'Status', container.status);
        drawField(ctx, 'Location', container.currentLocation?.address || container.location);
    }
    ctx.y += 10;
}

async function drawPreServiceDetails(ctx: any, req: any, technician: any, techUser: any) {
    drawSectionHeader(ctx, 'ASSIGNED TECHNICIAN');
    if (technician) {
        drawField(ctx, 'Name', techUser?.name);
        drawField(ctx, 'Employee Code', technician.employeeCode);
        drawField(ctx, 'Designation', technician.designation);
        drawField(ctx, 'Contact', techUser?.phoneNumber);
    } else {
        ctx.doc.text('No technician assigned.', LAYOUT.margin + 10, ctx.y);
        ctx.y += 20;
    }
    ctx.y += 10;

    if (technician) {
        drawSectionHeader(ctx, 'TECHNICIAN WAGE BREAKDOWN');
        const wageFields = [
            ['Grade', technician.grade || '-'],
            ['Designation', technician.designation || '-'],
            ['Base Daily Wage', `INR ${technician.baseWage || 0}`],
            ['Hotel Allowance', `INR ${technician.hotelAllowance || 0}`],
            ['Food Allowance', `INR ${technician.foodAllowance || 0}`],
            ['Travel Allowance', `INR ${technician.localTravelAllowance || 0}`]
        ];
        wageFields.forEach(([label, val]) => drawField(ctx, label, val));
        ctx.y += 10;
    }
    
    if (req.requiredParts && req.requiredParts.length > 0) {
        drawSectionHeader(ctx, 'REQUIRED PARTS / SPARES');
        req.requiredParts.forEach((part: string, i: number) => {
            checkPageBreak(ctx, 15);
            ctx.doc.text(`${i+1}. ${part}`, LAYOUT.margin + 10, ctx.y);
            ctx.y += 15;
        });
        ctx.y += 10;
    }
    
    if (req.coordinatorRemarks) {
        drawTextBlock(ctx, 'COORDINATOR REMARKS', sanitizeText(req.coordinatorRemarks));
    }
}

async function drawPostServiceDetails(ctx: any, req: any, technician: any, techUser: any) {
    drawSectionHeader(ctx, 'SERVICE EXECUTION TIMELINE');
    drawField(ctx, 'Scheduled', req.scheduledDate ? new Date(req.scheduledDate).toLocaleString() : '-');
    drawField(ctx, 'Started', req.actualStartTime ? new Date(req.actualStartTime).toLocaleString() : '-');
    drawField(ctx, 'Completed', req.actualEndTime ? new Date(req.actualEndTime).toLocaleString() : '-');
    ctx.y += 10;

    drawSectionHeader(ctx, 'ACTUAL COSTS INCURRED');
    drawField(ctx, 'Total Cost', `INR ${req.totalCost || 0}`);
    ctx.y += 10;
    
    const workText = req.resolutionNotes || req.technicianNotes || 'No resolution notes recorded.';
    drawTextBlock(ctx, 'WORK PERFORMED / RESOLUTION', sanitizeText(workText));
    
    if (req.usedParts && req.usedParts.length > 0) {
        drawSectionHeader(ctx, 'PARTS USED');
        req.usedParts.forEach((part: string, i: number) => {
            checkPageBreak(ctx, 15);
            ctx.doc.text(`${i+1}. ${part}`, LAYOUT.margin + 10, ctx.y);
            ctx.y += 15;
        });
        ctx.y += 10;
    }
    
    if (req.signedDocumentUrl) {
        await drawImages(ctx, 'CLIENT SIGNATURE', [req.signedDocumentUrl]);
    }
    if (req.vendorInvoiceUrl) {
        await drawImages(ctx, 'VENDOR INVOICE', [req.vendorInvoiceUrl]);
    }
    
    if (req.beforePhotos && req.beforePhotos.length > 0) {
         await drawImages(ctx, 'BEFORE SERVICE PHOTOS', req.beforePhotos);
    }
    if (req.afterPhotos && req.afterPhotos.length > 0) {
         await drawImages(ctx, 'AFTER SERVICE PHOTOS', req.afterPhotos);
    }
}

async function drawCompleteContent(ctx: any, req: any, customer: any, container: any, technician: any, techUser: any) {
    // Consolidated flow
    await drawInitialContent(ctx, req, customer, container);
    
    // Space before next section (or page break if not enough space)
    checkPageBreak(ctx, 100);
    
    await drawPreServiceDetails(ctx, req, technician, techUser);
    
    checkPageBreak(ctx, 100);
    
    await drawPostServiceDetails(ctx, req, technician, techUser);
}

// --- Helpers ---

function checkPageBreak(ctx: { doc: any, y: number }, needed: number) {
    if (ctx.y + needed > LAYOUT.height - LAYOUT.margin) {
        ctx.doc.addPage();
        ctx.y = LAYOUT.margin + 20; 
        return true;
    }
    return false;
}

function drawHeader(doc: any, stage: string, req: any) {
    const title = getReportTitle(stage);
    
    doc.rect(0, 0, LAYOUT.width, 70).fill(COLORS.primary);
    doc.rect(0, 0, LAYOUT.width, 2).fill('#E5E7EB');

    doc.fillColor(COLORS.white);
    doc.fontSize(9).text('SERVICE HUB MANAGEMENT SYSTEM', 0, 15, { align: 'center' });
    doc.fontSize(20).font('Helvetica-Bold').text(title, 0, 30, { align: 'center' });
    doc.fontSize(11).font('Helvetica').text(`Reference: ${req.requestNumber || req.id}`, 0, 55, { align: 'center' });

    const infoY = 85;
    doc.rect(LAYOUT.margin, infoY, LAYOUT.contentWidth, 25).fill(COLORS.secondary);
    doc.rect(LAYOUT.margin, infoY, LAYOUT.contentWidth, 25).stroke(COLORS.border);
    
    const dateStr = new Date().toLocaleString();
    doc.fillColor(COLORS.textLabel).fontSize(9).font('Helvetica')
       .text(`Report Generated: ${dateStr}`, LAYOUT.margin + 10, infoY + 8);

    const status = (req.status || 'PENDING').toUpperCase();
    let badgeColor = COLORS.info;
    if (status === 'COMPLETED') badgeColor = COLORS.success;
    if (status === 'SCHEDULED') badgeColor = COLORS.warning;
    if (status === 'IN_PROGRESS') badgeColor = COLORS.info;
    
    const badgeWidth = 100;
    const badgeX = LAYOUT.width - LAYOUT.margin - badgeWidth - 10;
    
    doc.roundedRect(badgeX, infoY + 5, badgeWidth, 15, 3).fill(badgeColor);
    doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold')
       .text(status, badgeX, infoY + 4, { width: badgeWidth, align: 'center' });

    doc.fillColor(COLORS.text);
}

function drawSectionHeader(ctx: { doc: any, y: number }, title: string) {
    checkPageBreak(ctx, 30);
    const doc = ctx.doc;
    
    doc.rect(LAYOUT.margin, ctx.y, LAYOUT.contentWidth, 20).fill(COLORS.secondary);
    doc.rect(LAYOUT.margin, ctx.y, 4, 20).fill(COLORS.primary);
    
    doc.fillColor(COLORS.primary).fontSize(12).font('Helvetica-Bold')
       .text(title, LAYOUT.margin + 15, ctx.y + 5);
       
    doc.moveTo(LAYOUT.margin, ctx.y + 20).lineTo(LAYOUT.width - LAYOUT.margin, ctx.y + 20)
       .lineWidth(0.5).stroke(COLORS.border);
       
    ctx.y += 30;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10);
}

function drawField(ctx: { doc: any, y: number }, label: string, value: any) {
    if (value === undefined || value === null || value === '') return;
    checkPageBreak(ctx, 15);
    const doc = ctx.doc;
    
    doc.font('Helvetica-Bold').fillColor(COLORS.textLabel).fontSize(9)
       .text(label + ':', LAYOUT.margin, ctx.y, { width: 120 });
       
    doc.font('Helvetica').fillColor(COLORS.text).fontSize(10)
       .text(sanitizeText(String(value)), LAYOUT.margin + 130, ctx.y, { width: LAYOUT.contentWidth - 130 });
       
    ctx.y += 15;
}

function drawTextBlock(ctx: { doc: any, y: number }, title: string, text: string) {
    if (!text) return;
    drawSectionHeader(ctx, title);
    
    const doc = ctx.doc;
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
    
    const width = LAYOUT.contentWidth - 20;
    const height = doc.heightOfString(text, { width });
    
    checkPageBreak(ctx, height + 10);
    
    doc.rect(LAYOUT.margin, ctx.y, LAYOUT.contentWidth, height + 10).fill('#FAFAFA');
    doc.rect(LAYOUT.margin, ctx.y, LAYOUT.contentWidth, height + 10).stroke('#E5E7EB');
    
    doc.text(text, LAYOUT.margin + 10, ctx.y + 5, { width });
    
    ctx.y += height + 20;
}

async function drawImages(ctx: any, title: string, urls: string[]) {
    drawSectionHeader(ctx, title);
    const doc = ctx.doc;
    
    const imgWidth = 400;
    const imgHeight = 300; 
    const x = (LAYOUT.width - imgWidth) / 2; // Centered
    
    // Parallel fetch
    const buffers = await Promise.all(urls.map(url => fetchImage(url)));
    
    for (const imgBuffer of buffers) {
        if (!imgBuffer) continue;
        
        checkPageBreak(ctx, imgHeight + 30);
        
        try {
            doc.image(imgBuffer, x, ctx.y, { fit: [imgWidth, imgHeight], align: 'center' });
            doc.rect(x, ctx.y, imgWidth, imgHeight).stroke(COLORS.border);
        } catch (e) {
            doc.rect(x, ctx.y, imgWidth, imgHeight).stroke(COLORS.danger);
            doc.text('Img Error', x+5, ctx.y+5);
        }
        
        ctx.y += imgHeight + 20;
    }
}

function drawCoverPage(ctx: any, req: any, customer: any) {
    const doc = ctx.doc;
    const height = LAYOUT.height;
    const width = LAYOUT.width;
    
    doc.rect(0, 0, width, height).fill('#FAFAFA');
    doc.rect(0, height / 3, width, 150).fill(COLORS.primary);
    
    doc.fillColor(COLORS.white).fontSize(24).font('Helvetica-Bold')
       .text('COMPLETE SERVICE REPORT', 0, height / 3 + 60, { align: 'center' });
       
    doc.fontSize(14).font('Helvetica')
       .text(`Reference: ${req.requestNumber || req.id}`, 0, height / 3 + 100, { align: 'center' });
       
    doc.fillColor(COLORS.text).fontSize(12);
    doc.text(`Client: ${customer?.companyName || 'Unknown'}`, 0, height - 200, { align: 'center' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 0, height - 180, { align: 'center' });
}

function drawFooter(doc: any, docId: string) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottom = LAYOUT.height - 30;
        
        doc.moveTo(LAYOUT.margin, bottom - 10).lineTo(LAYOUT.width - LAYOUT.margin, bottom - 10)
           .strokeColor(COLORS.border).lineWidth(0.5).stroke();
           
        doc.fontSize(8).fillColor(COLORS.textLabel);
        doc.text('Service Hub Management System', LAYOUT.margin, bottom);
        doc.text(`Page ${i + 1} of ${range.count}`, 0, bottom, { align: 'center' });
        doc.text(`Doc ID: ${docId.substring(0, 8).toUpperCase()}`, 0, bottom, { align: 'right' });
        
        doc.text('CONFIDENTIAL - This document contains proprietary information', 0, bottom + 10, { align: 'center' });
    }
}

function getReportTitle(stage: string) {
    switch(stage) {
        case 'pre_service': return 'PRE-SERVICE DEPLOYMENT REPORT';
        case 'post_service': return 'POST-SERVICE COMPLETION REPORT';
        case 'complete': return 'COMPLETE SERVICE REPORT';
        default: return 'SERVICE REQUEST REPORT';
    }
}
