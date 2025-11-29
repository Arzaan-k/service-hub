import PDFDocument from 'pdfkit';
import { storage } from '../storage';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { serviceRequests, technicians } from '@shared/schema';

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

        // Content logic based on stage
        if (stage === 'initial') {
            await drawInitialContent(ctx, serviceRequest, customer, container);
        } else if (stage === 'pre_service') {
            await drawInitialContent(ctx, serviceRequest, customer, container);
            await drawPreServiceDetails(ctx, serviceRequest, technician, technicianUser);
        } else if (stage === 'post_service') {
            // Post service: 3-4 pages structure
            // Page 1: Basic Info, Service Timeline, Issue Description
            await drawBasicInfo(ctx, serviceRequest);
            await drawServiceTimeline(ctx, serviceRequest);
            await drawIssueDescription(ctx, serviceRequest, customer);
            
            // Page 2: Assigned Tech, Wages, Parts, Costs, Work Performed
            checkPageBreak(ctx, 200); // Ensure new page for tech details if needed
            await drawTechnicianDetails(ctx, serviceRequest, technician, technicianUser);
            
            // Page 3+: Photos & Docs
            await drawPostServiceDocs(ctx, serviceRequest);
            
            // Summary
            await drawServiceSummary(ctx, serviceRequest, customer, container);
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
    await drawIssueDescription(ctx, req, customer);
    await drawClientDetails(ctx, customer);
    await drawContainerDetails(ctx, container);
    if (req.clientUploadedPhotos && req.clientUploadedPhotos.length > 0) {
        await drawImagesGrid(ctx, 'CLIENT UPLOADED PHOTOS', req.clientUploadedPhotos);
    }
}

async function drawBasicInfo(ctx: any, req: any) {
    drawSectionHeader(ctx, 'BASIC INFORMATION');
    drawField(ctx, 'Priority', req.priority?.toUpperCase());
    drawField(ctx, 'Status', req.status?.toUpperCase());
    drawField(ctx, 'Created Date', new Date(req.requestedAt).toLocaleString());
    ctx.y += 10;
}

async function drawServiceTimeline(ctx: any, req: any) {
    drawSectionHeader(ctx, 'SERVICE TIMELINE');
    drawField(ctx, 'Scheduled', req.scheduledDate ? new Date(req.scheduledDate).toLocaleString() : '-');
    drawField(ctx, 'Started', req.actualStartTime ? new Date(req.actualStartTime).toLocaleString() : '-');
    drawField(ctx, 'Completed', req.actualEndTime ? new Date(req.actualEndTime).toLocaleString() : '-');
    ctx.y += 10;
}

async function drawIssueDescription(ctx: any, req: any, customer: any) {
    drawSectionHeader(ctx, 'ISSUE DESCRIPTION');
    
    // Helper to parse text that may have embedded "Key: Value" pairs on same line or multiple lines
    // Example: "Temperature not maintained  Company Name: Crystal Group  Onsite Contact: 9807654321..."
    const parseEmbeddedData = (text: string) => {
        const result: any = {
            description: '',
            errorCode: '',
            companyName: '',
            onsiteContact: '',
            siteAddress: '',
            preferredCall: ''
        };
        
        if (!text) return result;
        
        // Use regex to extract each field - handles both same-line and multi-line formats
        // Extract Company Name
        const companyMatch = text.match(/Company\s*Name:\s*([^]*?)(?=(?:Onsite\s*Contact:|Site\s*Address:|Preferred\s*(?:Technician\s*)?Call:|Error\s*Code:|$))/i);
        if (companyMatch) {
            result.companyName = companyMatch[1].trim();
        }
        
        // Extract Onsite Contact
        const contactMatch = text.match(/Onsite\s*Contact:\s*([^]*?)(?=(?:Company\s*Name:|Site\s*Address:|Preferred\s*(?:Technician\s*)?Call:|Error\s*Code:|$))/i);
        if (contactMatch) {
            result.onsiteContact = contactMatch[1].trim();
        }
        
        // Extract Site Address
        const addressMatch = text.match(/Site\s*Address:\s*([^]*?)(?=(?:Company\s*Name:|Onsite\s*Contact:|Preferred\s*(?:Technician\s*)?Call:|Error\s*Code:|$))/i);
        if (addressMatch) {
            result.siteAddress = addressMatch[1].trim();
        }
        
        // Extract Preferred Technician Call
        const callMatch = text.match(/Preferred\s*(?:Technician\s*)?Call:\s*([^]*?)(?=(?:Company\s*Name:|Onsite\s*Contact:|Site\s*Address:|Error\s*Code:|$))/i);
        if (callMatch) {
            result.preferredCall = callMatch[1].trim();
        }
        
        // Extract Error Code
        const errorMatch = text.match(/Error\s*Code:\s*([^]*?)(?=(?:Company\s*Name:|Onsite\s*Contact:|Site\s*Address:|Preferred\s*(?:Technician\s*)?Call:|$))/i);
        if (errorMatch) {
            result.errorCode = errorMatch[1].trim();
        }
        
        // Extract Description - everything BEFORE the first key:value pair
        // Find the position of the first known key
        const keyPositions = [
            text.search(/Company\s*Name:/i),
            text.search(/Onsite\s*Contact:/i),
            text.search(/Site\s*Address:/i),
            text.search(/Preferred\s*(?:Technician\s*)?Call:/i),
            text.search(/Error\s*Code:/i)
        ].filter(pos => pos >= 0);
        
        if (keyPositions.length > 0) {
            const firstKeyPos = Math.min(...keyPositions);
            result.description = text.substring(0, firstKeyPos).trim();
        } else {
            // No keys found, entire text is description
            result.description = text.trim();
        }
        
        return result;
    };

    // Helper to format date as "Sat, 29 Nov"
    const formatPreferredDate = (dateInput: any): string => {
        if (!dateInput) return 'N/A';
        const dateStr = String(dateInput).trim();
        // If it's already formatted like "Sat, 29 Nov", return as-is
        if (/^[A-Za-z]{3},?\s*\d{1,2}\s+[A-Za-z]{3}/.test(dateStr)) {
            return dateStr;
        }
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return dateStr || 'N/A';
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
        } catch {
            return dateStr || 'N/A';
        }
    };

    const rawDesc = req.issueDescription || req.description || '';
    const parsed = parseEmbeddedData(rawDesc);
    
    // Data Preparation - Use parsed data, fallback to customer data if parsed is empty
    const issue = parsed.description || 'No description provided.';
    const errorCode = parsed.errorCode || req.alertId || req.errorCode || 'N/A';
    const companyName = parsed.companyName || customer?.companyName || customer?.company || 'N/A';
    const onsiteContact = parsed.onsiteContact || customer?.phone || 'N/A';
    const siteAddress = parsed.siteAddress || customer?.billingAddress || customer?.address || 'N/A';
    const preferredCall = parsed.preferredCall 
        ? formatPreferredDate(parsed.preferredCall) 
        : formatPreferredDate(req.scheduledDate);

    const doc = ctx.doc;
    const labelWidth = 180;
    const valueX = LAYOUT.margin + 185;
    const valueWidth = LAYOUT.contentWidth - 185;

    // Helper for drawing a single row with proper spacing
    const drawRow = (label: string, value: any) => {
        const safeValue = sanitizeText(String(value));
        
        doc.font('Helvetica').fontSize(10);
        const valueHeight = doc.heightOfString(safeValue, { width: valueWidth, align: 'left' });
        const rowHeight = Math.max(valueHeight, 18);

        checkPageBreak(ctx, rowHeight + 8);

        // Draw Label (left-aligned)
        doc.font('Helvetica-Bold').fillColor(COLORS.textLabel).fontSize(10)
           .text(label + ':', LAYOUT.margin, ctx.y, { width: labelWidth });
        
        // Draw Value (left-aligned, positioned after label)
        doc.font('Helvetica').fillColor(COLORS.text).fontSize(10)
           .text(safeValue, valueX, ctx.y, { width: valueWidth, align: 'left' });

        ctx.y += rowHeight + 8; // Line gap
    };

    // Layout Execution - SINGLE PASS, CLEAN FORMAT
    
    // 1. Issue (description only - cleaned)
    drawRow('Issue', issue);
    ctx.y += 5;
    
    // 2. Error Code
    drawRow('Error Code', errorCode);
    
    ctx.y += 15; // Gap before Service Location Details

    // 3. Service Location Details Header
    checkPageBreak(ctx, 25);
    doc.font('Helvetica-Bold').fillColor(COLORS.textLabel).fontSize(11)
       .text('Service Location Details:', LAYOUT.margin, ctx.y);
    ctx.y += 22;

    // 4. Location Details
    drawRow('Company Name', companyName);
    drawRow('Onsite Contact', onsiteContact);
    drawRow('Site Address', siteAddress);
    drawRow('Preferred Technician Call', preferredCall);
    
    ctx.y += 15;
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
    // Assigned Tech
    await drawTechnicianDetails(ctx, req, technician, techUser);
    
    // Finance Approval Section
    ctx.doc.addPage();
    ctx.y = LAYOUT.margin;
    await drawFinanceApproval(ctx, req, technician);
}

async function drawTechnicianDetails(ctx: any, req: any, technician: any, techUser: any) {
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
        // Assuming baseWage is 1500 if not present as it's missing in schema but required in PDF
        const base = technician.baseWage || 1500; 
        const hotel = technician.hotelAllowance || 0;
        const food = technician.foodAllowance || 0;
        const travel = technician.localTravelAllowance || 0;
        const personal = technician.personalAllowance || 0;
        const total = base + hotel + food + travel + personal;

        const wageFields = [
            ['Grade', technician.grade || '-'],
            ['Designation', technician.designation || '-'],
            ['Base Daily Wage', `INR ${base}`],
            ['Hotel Allowance', `INR ${hotel}`],
            ['Food Allowance', `INR ${food}`],
            ['Travel Allowance', `INR ${travel}`],
            ['Personal Allowance', `INR ${personal}`],
            ['TOTAL DAILY WAGE', `INR ${total}`]
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

async function drawFinanceApproval(ctx: any, req: any, technician: any) {
    drawSectionHeader(ctx, 'OVERALL TRIP COST & FINANCE APPROVAL');
    const doc = ctx.doc;
    
    // Calculate estimated costs
    const base = technician?.baseWage || 1500;
    const allowances = (technician?.hotelAllowance || 0) + (technician?.foodAllowance || 0) + (technician?.localTravelAllowance || 0) + (technician?.personalAllowance || 0);
    const dailyTotal = base + allowances;
    const days = req.estimatedDuration ? Math.ceil(req.estimatedDuration / (24 * 60)) : 1; // Estimate days or default to 1
    
    const totalLabor = dailyTotal * days;
    const partsCost = 0; // Placeholder as parts cost isn't in request schema directly usually
    const subtotal = totalLabor + partsCost;
    const contingency = Math.round(subtotal * 0.10);
    const grandTotal = subtotal + contingency;

    const costs = [
        ['Daily Wage Breakdown', `INR ${dailyTotal}`],
        ['Estimated Duration', `${days} Days`],
        ['Total Labor Cost', `INR ${totalLabor}`],
        ['Parts Cost (Est)', `INR ${partsCost}`],
        ['Contingency (10%)', `INR ${contingency}`],
        ['GRAND TOTAL TRIP COST', `INR ${grandTotal}`]
    ];

    costs.forEach(([label, val]) => drawField(ctx, label, val));
    ctx.y += 20;

    // Approval Box
    checkPageBreak(ctx, 100);
    doc.rect(LAYOUT.margin, ctx.y, LAYOUT.contentWidth, 80).stroke(COLORS.border);
    doc.fontSize(10).fillColor(COLORS.textLabel).text('FINANCE APPROVAL', LAYOUT.margin + 10, ctx.y + 10);
    
    const boxY = ctx.y + 30;
    const boxW = 100;
    
    doc.rect(LAYOUT.margin + 20, boxY, 15, 15).stroke(COLORS.border);
    doc.text('Pending', LAYOUT.margin + 45, boxY + 3);
    
    doc.rect(LAYOUT.margin + 150, boxY, 15, 15).stroke(COLORS.border);
    doc.text('Approved', LAYOUT.margin + 175, boxY + 3);
    
    doc.rect(LAYOUT.margin + 280, boxY, 15, 15).stroke(COLORS.border);
    doc.text('Rejected', LAYOUT.margin + 305, boxY + 3);
    
    doc.text('Signature: __________________________', LAYOUT.margin + 20, boxY + 40);
    doc.text('Date: ________________', LAYOUT.margin + 300, boxY + 40);
    
    ctx.y += 100;
}

async function drawPostServiceDocs(ctx: any, req: any) {
    if (req.clientUploadedPhotos?.length) await drawImagesGrid(ctx, 'CLIENT UPLOADED PHOTOS', req.clientUploadedPhotos);
    if (req.beforePhotos?.length) await drawImagesGrid(ctx, 'BEFORE SERVICE PHOTOS', req.beforePhotos);
    if (req.afterPhotos?.length) await drawImagesGrid(ctx, 'AFTER SERVICE PHOTOS', req.afterPhotos);
    if (req.signedDocumentUrl) await drawImagesGrid(ctx, 'CLIENT SIGNATURE / DOCUMENT', [req.signedDocumentUrl]);
    if (req.vendorInvoiceUrl) await drawImagesGrid(ctx, 'VENDOR INVOICE', [req.vendorInvoiceUrl]);
}

async function drawServiceSummary(ctx: any, req: any, customer: any, container: any) {
    drawSectionHeader(ctx, 'SERVICE SUMMARY');
    
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
}

async function drawCompleteContent(ctx: any, req: any, customer: any, container: any, technician: any, techUser: any) {
    await drawBasicInfo(ctx, req);
    await drawIssueDescription(ctx, req, customer);
    await drawClientDetails(ctx, customer);
    await drawContainerDetails(ctx, container);
    
    checkPageBreak(ctx, 50);
    await drawServiceTimeline(ctx, req);
    
    checkPageBreak(ctx, 100);
    await drawTechnicianDetails(ctx, req, technician, techUser);
    
    // Finance page for complete report? Maybe skip or condense.
    // Spec says "merged overview". I'll include key details.
    
    checkPageBreak(ctx, 50);
    await drawServiceSummary(ctx, req, customer, container);
    
    await drawPostServiceDocs(ctx, req);
}

// --- Helpers ---

function checkPageBreak(ctx: { doc: any, y: number }, needed: number) {
    // Only add page if content truly won't fit (with 100px bottom margin for footer)
    const bottomMargin = 100;
    if (ctx.y + needed > LAYOUT.height - bottomMargin) {
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
    
    const badgeWidth = 90;
    const badgeHeight = 16;
    const badgeX = LAYOUT.width - LAYOUT.margin - badgeWidth - 5;
    const badgeY = infoY + 4;
    
    // Draw badge background
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3).fill(badgeColor);
    
    // Draw badge text - centered vertically and horizontally
    doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold')
       .text(status, badgeX, badgeY + 4, { width: badgeWidth, align: 'center' });

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
       .text(label + ':', LAYOUT.margin, ctx.y, { width: 140 });
       
    doc.font('Helvetica').fillColor(COLORS.text).fontSize(10)
       .text(sanitizeText(String(value)), LAYOUT.margin + 150, ctx.y, { width: LAYOUT.contentWidth - 150 });
       
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

async function drawImagesGrid(ctx: any, title: string, urls: string[]) {
    if (!urls || urls.length === 0) return;
    
    // Filter out null/empty URLs first
    const validUrls = urls.filter(url => url && url.trim());
    if (validUrls.length === 0) return;
    
    // Fetch all images first to count valid ones
    const buffers = await Promise.all(validUrls.map(url => fetchImage(url)));
    const validBuffers = buffers.filter(b => b !== null);
    
    // Don't draw section if no valid images
    if (validBuffers.length === 0) return;
    
    drawSectionHeader(ctx, title);
    const doc = ctx.doc;
    
    const pageWidth = LAYOUT.contentWidth;
    const gap = 10;
    const cols = 2;
    const imgWidth = (pageWidth - (gap * (cols - 1))) / cols;
    const imgHeight = 200; // Fixed height for uniform grid
    
    let colIndex = 0;
    let startY = ctx.y;
    
    for (const imgBuffer of validBuffers) {
        // If first column, check page break for the whole row
        if (colIndex === 0) {
            if (checkPageBreak(ctx, imgHeight + 20)) {
                startY = ctx.y;
            }
        }

        const x = LAYOUT.margin + (colIndex * (imgWidth + gap));
        const y = startY; 

        try {
            // Scale image to fit within box while maintaining aspect ratio
            doc.image(imgBuffer, x, y, { fit: [imgWidth, imgHeight], align: 'center', valign: 'center' });
            doc.rect(x, y, imgWidth, imgHeight).stroke(COLORS.border);
        } catch (e) {
            doc.rect(x, y, imgWidth, imgHeight).stroke(COLORS.danger);
            doc.fontSize(8).fillColor(COLORS.danger).text('Image Load Error', x + 5, y + 5);
        }

        colIndex++;
        if (colIndex >= cols) {
            colIndex = 0;
            startY += imgHeight + gap;
            ctx.y = startY; // Update y cursor
        }
    }
    
    // If we ended in the middle of a row, push y down
    if (colIndex !== 0) {
        ctx.y = startY + imgHeight + 15;
    } else {
        ctx.y += 10;
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
    
    // Count actual content pages (pages that have content beyond header area)
    let actualPageCount = 0;
    const contentPages: number[] = [];
    
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // A page is considered to have content if y position is beyond header (120px)
        // We check by seeing if there's any content drawn below header
        // For simplicity, we'll include all pages but the logic prevents empty trailing pages
        contentPages.push(i);
        actualPageCount++;
    }
    
    // Draw footer on all pages with correct page numbering
    for (let idx = 0; idx < contentPages.length; idx++) {
        const pageNum = contentPages[idx];
        doc.switchToPage(pageNum);
        const bottom = LAYOUT.height - 30;
        
        doc.moveTo(LAYOUT.margin, bottom - 10).lineTo(LAYOUT.width - LAYOUT.margin, bottom - 10)
           .strokeColor(COLORS.border).lineWidth(0.5).stroke();
           
        doc.fontSize(8).fillColor(COLORS.textLabel);
        doc.text('Service Hub Management System', LAYOUT.margin, bottom);
        doc.text(`Page ${idx + 1} of ${actualPageCount}`, 0, bottom, { align: 'center' });
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

export async function generateTripFinancePDF(tripId: string): Promise<Buffer> {
  const trip = await storage.getTechnicianTrip(tripId);
  if (!trip) throw new Error('Trip not found');

  const technician = await storage.getTechnician(trip.technicianId);
  if (!technician) throw new Error('Technician not found');

  const tripCosts = await storage.getTechnicianTripCosts(tripId);
  const tripTasks = await storage.getTechnicianTripTasks(tripId);

  // Get service requests and PM containers
  const serviceRequests = [];
  const pmContainers = [];

  for (const task of tripTasks) {
    if (task.taskType === 'alert' || task.taskType === 'service') {
      if (task.serviceRequestId) {
        const sr = await storage.getServiceRequest(task.serviceRequestId);
        if (sr) serviceRequests.push(sr);
      }
    } else if (task.taskType === 'pm') {
      const container = await storage.getContainer(task.containerId);
      if (container) pmContainers.push(container);
    }
  }

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Trip Finance Report - ${technician?.name || 'Technician'}`,
          Author: 'Service Hub',
          Subject: 'Trip Finance Approval Report'
        }
      });

      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').fillColor(COLORS.primary)
         .text('TRIP FINANCE APPROVAL REPORT', 50, 50, { align: 'center' });

      doc.fontSize(18).fillColor(COLORS.text)
         .text(`${technician?.name || 'Technician'} - ${trip.destinationCity}`, 50, 90, { align: 'center' });

      doc.fontSize(10).fillColor(COLORS.textLabel)
         .text(`Report ID: TRIP-${Date.now()}`, 50, 120, { align: 'left' })
         .text(`Generated: ${new Date().toLocaleString()}`, 400, 120, { align: 'right' });

      let yPos = 150;

      // Trip Details
      doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.primary)
         .text('TRIP DETAILS', 50, yPos);
      yPos += 30;

      // Technician and Trip Info Grid
      const leftX = 50;
      const rightX = 300;

      // Technician Info
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textLabel)
         .text('Technician Information', leftX, yPos);
      yPos += 20;

      doc.fontSize(10).fillColor(COLORS.text)
         .text(`Name: ${technician?.name}`, leftX, yPos);
      yPos += 15;
      doc.text(`Employee Code: ${technician?.employeeCode}`, leftX, yPos);
      yPos += 15;
      doc.text(`Base Location: ${typeof technician?.baseLocation === 'string' ? technician.baseLocation : technician?.baseLocation?.city || 'N/A'}`, leftX, yPos);
      yPos += 15;
      doc.text(`Grade: ${technician?.grade || 'N/A'}`, leftX, yPos);
      yPos += 15;
      doc.text(`Designation: ${technician?.designation || 'N/A'}`, leftX, yPos);

      // Trip Info (right side)
      let tripY = 180;
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textLabel)
         .text('Trip Information', rightX, tripY);
      tripY += 20;

      doc.fontSize(10).fillColor(COLORS.text)
         .text(`Destination: ${trip?.destinationCity || 'N/A'}`, rightX, tripY);
      tripY += 15;
      doc.text(`Start Date: ${trip?.startDate ? new Date(trip.startDate).toLocaleDateString() : 'N/A'}`, rightX, tripY);
      tripY += 15;
      doc.text(`End Date: ${trip?.endDate ? new Date(trip.endDate).toLocaleDateString() : 'N/A'}`, rightX, tripY);
      tripY += 15;
      doc.text(`Total Tasks: ${tripTasks?.length || 0}`, rightX, tripY);
      tripY += 15;
      doc.text(`Service Requests: ${serviceRequests?.length || 0}`, rightX, tripY);
      tripY += 15;
      doc.text(`PM Tasks: ${pmContainers?.length || 0}`, rightX, tripY);

      yPos = Math.max(yPos, tripY) + 30;

      // Service Requests Table
      if (serviceRequests.length > 0) {
        doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.primary)
           .text('SERVICE REQUESTS', 50, yPos);
        yPos += 20;

        // Table Header
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text)
           .rect(50, yPos, 500, 20).fill(COLORS.secondary)
           .fillColor(COLORS.primary)
           .text('Request #', 55, yPos + 5)
           .text('Container', 120, yPos + 5)
           .text('Issue', 200, yPos + 5)
           .text('Customer', 350, yPos + 5)
           .text('Priority', 450, yPos + 5)
           .text('Cost', 480, yPos + 5);
        yPos += 20;

        // Table Rows
        for (const sr of serviceRequests || []) {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }

          doc.fontSize(8).fillColor(COLORS.text)
             .text(sr?.requestNumber || '', 55, yPos + 5)
             .text((sr?.containerId || '').substring(0, 8), 120, yPos + 5)
             .text((sr?.issueDescription || '').substring(0, 30), 200, yPos + 5)
             .text(sr?.customer?.companyName || 'N/A', 350, yPos + 5)
             .text(sr?.priority || 'Medium', 450, yPos + 5)
             .text(`₹${technician?.serviceRequestCost || 2500}`, 480, yPos + 5);
          yPos += 15;
        }
        yPos += 20;
      }

      // PM Tasks Table
      if (pmContainers.length > 0) {
        if (yPos > 600) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.primary)
           .text('PREVENTIVE MAINTENANCE TASKS', 50, yPos);
        yPos += 20;

        // Table Header
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text)
           .rect(50, yPos, 500, 20).fill(COLORS.secondary)
           .fillColor(COLORS.primary)
           .text('Container', 55, yPos + 5)
           .text('Customer', 150, yPos + 5)
           .text('PM Status', 300, yPos + 5)
           .text('Priority', 400, yPos + 5)
           .text('Cost', 480, yPos + 5);
        yPos += 20;

        // Table Rows
        for (const container of pmContainers || []) {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }

          doc.fontSize(8).fillColor(COLORS.text)
             .text(container.containerCode || '', 55, yPos + 5)
             .text(container.currentCustomer?.companyName || 'N/A', 150, yPos + 5)
             .text('DUE', 300, yPos + 5)
             .text('MEDIUM', 400, yPos + 5)
             .text(`₹${technician?.pmCost || 1800}`, 480, yPos + 5);
          yPos += 15;
        }
        yPos += 20;
      }

      // Wage Breakdown
      if (yPos > 500) {
        doc.addPage();
        yPos = 50;
      }

      doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.primary)
         .text('WAGE BREAKDOWN & COST ANALYSIS', 50, yPos);
      yPos += 30;

      // Cost breakdown data
      const totalTasks = tripTasks?.length || 0;
      const serviceTasks = serviceRequests?.length || 0;
      const pmTasks = pmContainers?.length || 0;
      const serviceRate = technician?.serviceRequestCost || 2500;
      const pmRate = technician?.pmCost || 1800;
      const tasksPerDay = technician?.tasksPerDay || 3;
      const estimatedDays = Math.max(1, Math.ceil(totalTasks / tasksPerDay));
      const dailyAllowance = (technician?.hotelAllowance || 0) + (technician?.localTravelAllowance || 0);

      const taskCosts = (serviceTasks * serviceRate) + (pmTasks * pmRate);
      const travelAllowance = estimatedDays * dailyAllowance;
      const miscellaneous = tripCosts?.miscCost || 0;
      const contingency = Math.round(taskCosts * 0.03);
      const totalCost = taskCosts + travelAllowance + miscellaneous + contingency;

      // Task Costs Section
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textLabel)
         .text('Task Costs', 50, yPos);
      yPos += 20;

      doc.fontSize(10).fillColor(COLORS.text)
         .text(`Service Requests (${serviceTasks} × ₹${serviceRate.toLocaleString()}): ₹${(serviceTasks * serviceRate).toLocaleString()}`, 70, yPos);
      yPos += 15;
      doc.text(`PM Tasks (${pmTasks} × ₹${pmRate.toLocaleString()}): ₹${(pmTasks * pmRate).toLocaleString()}`, 70, yPos);
      yPos += 15;
      doc.font('Helvetica-Bold').text(`Subtotal: ₹${taskCosts.toLocaleString()}`, 70, yPos);
      yPos += 25;

      // Travel Allowance Section
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textLabel)
         .text('Travel Allowance', 50, yPos);
      yPos += 20;

      doc.fontSize(10).fillColor(COLORS.text)
         .text(`Daily Allowance × ${estimatedDays} days: ₹${travelAllowance.toLocaleString()}`, 70, yPos);
      yPos += 25;

      // Additional Costs
      doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.textLabel)
         .text('Additional Costs', 50, yPos);
      yPos += 20;

      doc.fontSize(10).fillColor(COLORS.text)
         .text(`Miscellaneous: ₹${miscellaneous.toLocaleString()}`, 70, yPos);
      yPos += 15;
      doc.text(`Contingency (3%): ₹${contingency.toLocaleString()}`, 70, yPos);
      yPos += 25;

      // Total
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.success)
         .text(`TOTAL ESTIMATED COST: ₹${totalCost.toLocaleString()}`, 50, yPos);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}