import jsPDF from 'jspdf';

interface ServiceRequestData {
  id: string;
  requestNumber: string;
  status: string;
  priority: string;
  issueDescription: string;
  createdAt: string;
  scheduledDate?: string;
  completedAt?: string;
  customer?: {
    name?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    whatsappNumber?: string;
    company?: string;
    companyName?: string;
    address?: string;
    billingAddress?: string;
    shippingAddress?: string;
    customerTier?: string;
    gstin?: string;
    paymentTerms?: string;
    status?: string;
  };
  technician?: {
    name: string;
    phone?: string;
    email?: string;
    specialization?: string;
  };
  containers?: Array<{
    containerCode: string;
    location?: string;
    type?: string;
    status?: string;
  }>;
  requiredParts?: string[];
  diagnosis?: string;
  resolution?: string;
  workPerformed?: string;
  comments?: string;
  totalCost?: string;
  laborCost?: string;
  partsCost?: string;
  estimatedDuration?: string;
  actualDuration?: string;
  clientUploadedPhotos?: string[];
  beforePhotos?: string[];
  afterPhotos?: string[];
  urgency?: string;
  serviceType?: string;
  assignedBy?: string;
  approvedBy?: string;
}

// Helper function to load image as base64
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load image:', url, error);
    return null;
  }
};

export const generateServiceRequestPDF = async (data: ServiceRequestData) => {
  const pdf = new jsPDF();
  let yPosition = 20;
  const leftMargin = 20;
  const rightMargin = 20;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const lineHeight = 7;
  const maxWidth = pageWidth - leftMargin - rightMargin;

  // Helper function to check if we need a new page
  const checkPageBreak = (neededSpace: number = 20): number => {
    if (yPosition + neededSpace > pageHeight - 30) {
      pdf.addPage();
      return 20;
    }
    return yPosition;
  };

  // Helper function to add wrapped text
  const addWrappedText = (text: string | null | undefined, x: number, y: number, maxWidth: number, options?: { bold?: boolean; fontSize?: number }): number => {
    if (!text || text === 'undefined' || text === 'null' || String(text).trim() === '') return y;

    const textStr = String(text).trim();
    if (!textStr) return y;

    if (options?.bold) pdf.setFont('helvetica', 'bold');
    else pdf.setFont('helvetica', 'normal');

    if (options?.fontSize) pdf.setFontSize(options.fontSize);
    else pdf.setFontSize(10);

    // Split text into lines that fit the width
    const lines = pdf.splitTextToSize(textStr, maxWidth);
    let currentY = y;

    // Add each line with proper spacing
    for (let i = 0; i < lines.length; i++) {
      currentY = checkPageBreak(lineHeight + 2);
      pdf.text(lines[i], x, currentY);
      currentY += lineHeight;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    return currentY;
  };

  // Helper function to add section header (professional style)
  const addSectionHeader = (title: string): number => {
    yPosition = checkPageBreak(20);

    // Section header background
    pdf.setFillColor(240, 243, 248);
    pdf.rect(leftMargin, yPosition, maxWidth, 10, 'F');

    // Left accent bar
    pdf.setFillColor(25, 55, 130);
    pdf.rect(leftMargin, yPosition, 3, 10, 'F');

    // Section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(25, 55, 130);
    pdf.text(title, leftMargin + 8, yPosition + 7);

    // Bottom border
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(leftMargin, yPosition + 10, pageWidth - rightMargin, yPosition + 10);

    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    yPosition += 16;

    return yPosition;
  };

  // Helper function to add a field (professional two-column layout)
  const addField = (label: string, value: string | undefined | null, indent: number = 0): number => {
    // Check for null, undefined, empty string, or string representations of null/undefined
    if (!value || value === 'undefined' || value === 'null' || value === '' || String(value).trim() === '') {
      return yPosition;
    }

    const stringValue = String(value).trim();
    if (!stringValue) return yPosition;

    yPosition = checkPageBreak(lineHeight + 2);

    // Label in blue/gray color
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(70, 70, 100);
    pdf.text(`${label}:`, leftMargin + indent, yPosition);

    // Value in black
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const labelWidth = 55; // Fixed width for consistent alignment

    // Split value text to fit within available width
    const valueLines = pdf.splitTextToSize(stringValue, maxWidth - indent - labelWidth - 5);
    let currentY = yPosition;

    for (let i = 0; i < valueLines.length; i++) {
      if (i > 0) {
        currentY = checkPageBreak(lineHeight);
      }
      pdf.text(valueLines[i], leftMargin + indent + labelWidth, currentY);
      if (i < valueLines.length - 1) {
        currentY += lineHeight;
      }
    }

    pdf.setTextColor(0, 0, 0);
    return currentY + lineHeight + 1;
  };

  // ============ PROFESSIONAL HEADER ============
  // Header background with gradient effect (darker blue)
  pdf.setFillColor(25, 55, 130);
  pdf.rect(0, 0, pageWidth, 45, 'F');

  // Top accent line
  pdf.setFillColor(200, 200, 200);
  pdf.rect(0, 0, pageWidth, 2, 'F');

  // Company/System name
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('SERVICE HUB MANAGEMENT SYSTEM', pageWidth / 2, 12, { align: 'center' });

  // Main title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('SERVICE REQUEST REPORT', pageWidth / 2, 23, { align: 'center' });

  // Request number
  pdf.setFontSize(11);
  const requestNumber = data.requestNumber ? String(data.requestNumber) : 'N/A';
  pdf.text(`Reference: ${requestNumber}`, pageWidth / 2, 35, { align: 'center' });

  pdf.setTextColor(0, 0, 0);
  yPosition = 55;

  // Info bar with generation details and status
  pdf.setFillColor(245, 247, 250);
  pdf.rect(leftMargin, yPosition, maxWidth, 16, 'F');
  pdf.setDrawColor(220, 220, 220);
  pdf.rect(leftMargin, yPosition, maxWidth, 16, 'S');

  // Generation date
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 80);
  pdf.setFont('helvetica', 'normal');
  const genDate = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
  pdf.text(`Report Generated: ${genDate}`, leftMargin + 5, yPosition + 10);

  // Status badge (professional style)
  const statusX = pageWidth - rightMargin - 55;
  const statusText = (data.status || 'pending').toUpperCase().replace(/_/g, ' ').replace(/-/g, ' ');
  const statusColor = data.status === 'completed' ? [22, 163, 74] :
                      data.status === 'in-progress' || data.status === 'in_progress' ? [37, 99, 235] :
                      data.status === 'scheduled' ? [234, 179, 8] :
                      [239, 68, 68];
  pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.roundedRect(statusX, yPosition + 4, 50, 8, 1, 1, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text(statusText, statusX + 25, yPosition + 9.5, { align: 'center' });

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  yPosition += 22;

  // ============ BASIC INFORMATION ============
  yPosition = addSectionHeader('BASIC INFORMATION');

  // Helper function to format date safely
  const formatDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr; // Return original if invalid
      return date.toLocaleString('en-US', {
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (error) {
      return dateStr; // Return original string if parsing fails
    }
  };

  // Helper function to format status/priority
  const formatStatus = (value: string | undefined | null): string => {
    if (!value) return '';
    return String(value).toUpperCase().replace(/_/g, ' ').replace(/-/g, ' ');
  };

  if (data.priority) {
    yPosition = addField('Priority', formatStatus(data.priority));
  }
  if (data.status) {
    yPosition = addField('Status', formatStatus(data.status));
  }
  if (data.serviceType) {
    yPosition = addField('Service Type', String(data.serviceType));
  }
  if (data.createdAt) {
    const formattedDate = formatDate(data.createdAt);
    if (formattedDate) {
      yPosition = addField('Created Date', formattedDate);
    }
  }
  if (data.scheduledDate) {
    const formattedDate = formatDate(data.scheduledDate);
    if (formattedDate) {
      yPosition = addField('Scheduled Date', formattedDate);
    }
  }
  if (data.completedAt) {
    const formattedDate = formatDate(data.completedAt);
    if (formattedDate) {
      yPosition = addField('Completed Date', formattedDate);
    }
  }
  if (data.estimatedDuration) yPosition = addField('Estimated Duration', data.estimatedDuration);
  if (data.actualDuration) yPosition = addField('Actual Duration', data.actualDuration);
  yPosition += 5;

  // Helper function to remove emojis and special Unicode characters
  const sanitizeText = (text: string): string => {
    if (!text) return '';
    // Remove emojis and other non-printable Unicode characters
    return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  };

  // ============ ISSUE DESCRIPTION ============
  if (data.issueDescription && String(data.issueDescription).trim()) {
    yPosition = addSectionHeader('ISSUE DESCRIPTION');

    // Ensure we have enough space and don't draw over text
    yPosition = checkPageBreak(30);

    // Add subtle background box for text content
    const textStartY = yPosition;
    const issueText = sanitizeText(String(data.issueDescription));
    const issueLines = pdf.splitTextToSize(issueText, maxWidth - 10);
    const boxHeight = issueLines.length * lineHeight + 8;

    pdf.setFillColor(252, 252, 254);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'F');
    pdf.setDrawColor(230, 230, 235);
    pdf.setLineWidth(0.3);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'S');

    // Add the issue description text with proper line breaks
    yPosition += 3;
    pdf.setTextColor(40, 40, 40);
    for (let i = 0; i < issueLines.length; i++) {
      yPosition = checkPageBreak(lineHeight + 2);
      pdf.text(issueLines[i], leftMargin + 5, yPosition);
      yPosition += lineHeight;
    }
    pdf.setTextColor(0, 0, 0);

    yPosition += 8;
  }

  // ============ CLIENT DETAILS ============
  if (data.customer && (data.customer.name || data.customer.contactPerson || data.customer.companyName)) {
    yPosition = addSectionHeader('CLIENT DETAILS');
    
    // Contact Person / Name
    if (data.customer.contactPerson) {
      yPosition = addField('Contact Person', data.customer.contactPerson);
    } else if (data.customer.name) {
      yPosition = addField('Contact Person', data.customer.name);
    }
    
    // Company Name
    if (data.customer.companyName) {
      yPosition = addField('Company Name', data.customer.companyName);
    } else if (data.customer.company) {
      yPosition = addField('Company Name', data.customer.company);
    }
    
    // Phone
    if (data.customer.phone) {
      yPosition = addField('Phone Number', data.customer.phone);
    }
    
    // WhatsApp Number
    if (data.customer.whatsappNumber) {
      yPosition = addField('WhatsApp Number', data.customer.whatsappNumber);
    }
    
    // Email
    if (data.customer.email) {
      yPosition = addField('Email', data.customer.email);
    }
    
    // Customer Tier
    if (data.customer.customerTier) {
      yPosition = addField('Customer Tier', data.customer.customerTier.toUpperCase());
    }
    
    // GSTIN
    if (data.customer.gstin) {
      yPosition = addField('GSTIN', data.customer.gstin);
    }
    
    // Payment Terms
    if (data.customer.paymentTerms) {
      yPosition = addField('Payment Terms', data.customer.paymentTerms.toUpperCase());
    }
    
    // Status
    if (data.customer.status) {
      yPosition = addField('Status', data.customer.status.toUpperCase());
    }
    
    // Billing Address
    if (data.customer.billingAddress) {
      yPosition = addField('Billing Address', data.customer.billingAddress);
    }
    
    // Shipping Address
    if (data.customer.shippingAddress) {
      yPosition = addField('Shipping Address', data.customer.shippingAddress);
    } else if (data.customer.address) {
      yPosition = addField('Address', data.customer.address);
    }
    
    yPosition += 5;
  }

  // ============ TECHNICIAN INFORMATION ============
  if (data.technician?.name) {
    yPosition = addSectionHeader('ASSIGNED TECHNICIAN');
    yPosition = addField('Name', data.technician.name);
    if (data.technician.specialization) yPosition = addField('Specialization', data.technician.specialization);
    if (data.technician.phone) yPosition = addField('Phone', data.technician.phone);
    if (data.technician.email) yPosition = addField('Email', data.technician.email);
    yPosition += 5;
  }

  // ============ CONTAINER INFORMATION ============
  if (data.containers && Array.isArray(data.containers) && data.containers.length > 0) {
    yPosition = addSectionHeader('CONTAINER DETAILS');
    data.containers.forEach((container, index) => {
      if (!container) return; // Skip null/undefined containers
      
      yPosition = checkPageBreak(25);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Container ${index + 1}:`, leftMargin, yPosition);
      yPosition += lineHeight;

      if (container.containerCode) {
        yPosition = addField('Container Code', String(container.containerCode), 5);
      }
      if (container.location) {
        yPosition = addField('Location', String(container.location), 5);
      }
      if (container.type) {
        yPosition = addField('Type', String(container.type), 5);
      }
      if (container.status) {
        yPosition = addField('Status', formatStatus(String(container.status)), 5);
      }
      yPosition += 3;
    });
    yPosition += 2;
  }

  // ============ DIAGNOSIS ============
  if (data.diagnosis && String(data.diagnosis).trim()) {
    yPosition = addSectionHeader('TECHNICAL DIAGNOSIS');
    yPosition = checkPageBreak(30);

    // Add subtle background box for text content
    const textStartY = yPosition;
    const diagnosisText = sanitizeText(String(data.diagnosis));
    const diagnosisLines = pdf.splitTextToSize(diagnosisText, maxWidth - 10);
    const boxHeight = diagnosisLines.length * lineHeight + 8;

    pdf.setFillColor(252, 252, 254);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'F');
    pdf.setDrawColor(230, 230, 235);
    pdf.setLineWidth(0.3);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'S');

    yPosition += 3;
    pdf.setTextColor(40, 40, 40);
    for (let i = 0; i < diagnosisLines.length; i++) {
      yPosition = checkPageBreak(lineHeight + 2);
      pdf.text(diagnosisLines[i], leftMargin + 5, yPosition);
      yPosition += lineHeight;
    }
    pdf.setTextColor(0, 0, 0);

    yPosition += 8;
  }

  // ============ REQUIRED PARTS ============
  if (data.requiredParts && Array.isArray(data.requiredParts) && data.requiredParts.length > 0) {
    yPosition = addSectionHeader('REQUIRED PARTS / SPARES');
    yPosition += 2; // Add extra spacing before content
    data.requiredParts.forEach((part, index) => {
      if (!part) return; // Skip null/undefined parts
      const partStr = String(part).trim();
      if (!partStr) return;
      yPosition = checkPageBreak(lineHeight);
      pdf.text(`${index + 1}. ${partStr}`, leftMargin + 5, yPosition);
      yPosition += lineHeight;
    });
    yPosition += 5;
  }

  // ============ WORK PERFORMED ============
  if (data.workPerformed && String(data.workPerformed).trim()) {
    yPosition = addSectionHeader('WORK PERFORMED');
    yPosition = checkPageBreak(30);

    // Add subtle background box for text content
    const textStartY = yPosition;
    const workText = sanitizeText(String(data.workPerformed));
    const workLines = pdf.splitTextToSize(workText, maxWidth - 10);
    const boxHeight = workLines.length * lineHeight + 8;

    pdf.setFillColor(252, 252, 254);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'F');
    pdf.setDrawColor(230, 230, 235);
    pdf.setLineWidth(0.3);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'S');

    yPosition += 3;
    pdf.setTextColor(40, 40, 40);
    for (let i = 0; i < workLines.length; i++) {
      yPosition = checkPageBreak(lineHeight + 2);
      pdf.text(workLines[i], leftMargin + 5, yPosition);
      yPosition += lineHeight;
    }
    pdf.setTextColor(0, 0, 0);

    yPosition += 8;
  }

  // ============ RESOLUTION ============
  if (data.resolution && String(data.resolution).trim()) {
    yPosition = addSectionHeader('RESOLUTION & OUTCOME');
    yPosition = checkPageBreak(30);

    // Add subtle background box for text content
    const textStartY = yPosition;
    const resolutionText = sanitizeText(String(data.resolution));
    const resolutionLines = pdf.splitTextToSize(resolutionText, maxWidth - 10);
    const boxHeight = resolutionLines.length * lineHeight + 8;

    pdf.setFillColor(252, 252, 254);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'F');
    pdf.setDrawColor(230, 230, 235);
    pdf.setLineWidth(0.3);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'S');

    yPosition += 3;
    pdf.setTextColor(40, 40, 40);
    for (let i = 0; i < resolutionLines.length; i++) {
      yPosition = checkPageBreak(lineHeight + 2);
      pdf.text(resolutionLines[i], leftMargin + 5, yPosition);
      yPosition += lineHeight;
    }
    pdf.setTextColor(0, 0, 0);

    yPosition += 8;
  }

  // ============ ADDITIONAL COMMENTS ============
  if (data.comments && String(data.comments).trim()) {
    yPosition = addSectionHeader('ADDITIONAL NOTES');
    yPosition = checkPageBreak(30);

    // Add subtle background box for text content
    const textStartY = yPosition;
    const commentsText = sanitizeText(String(data.comments));
    const commentsLines = pdf.splitTextToSize(commentsText, maxWidth - 10);
    const boxHeight = commentsLines.length * lineHeight + 8;

    pdf.setFillColor(252, 252, 254);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'F');
    pdf.setDrawColor(230, 230, 235);
    pdf.setLineWidth(0.3);
    pdf.rect(leftMargin, textStartY - 2, maxWidth, boxHeight, 'S');

    yPosition += 3;
    pdf.setTextColor(40, 40, 40);
    for (let i = 0; i < commentsLines.length; i++) {
      yPosition = checkPageBreak(lineHeight + 2);
      pdf.text(commentsLines[i], leftMargin + 5, yPosition);
      yPosition += lineHeight;
    }
    pdf.setTextColor(0, 0, 0);

    yPosition += 8;
  }

  // ============ COST BREAKDOWN ============
  if (data.totalCost || data.laborCost || data.partsCost) {
    yPosition = addSectionHeader('COST BREAKDOWN');

    yPosition = checkPageBreak(40);
    const costTableY = yPosition;

    // Professional table styling
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);

    // Table header with company blue
    pdf.setFillColor(25, 55, 130);
    pdf.rect(leftMargin, costTableY, maxWidth, 12, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Cost Item', leftMargin + 5, costTableY + 8);
    pdf.text('Amount (INR)', pageWidth - rightMargin - 50, costTableY + 8);
    pdf.setTextColor(0, 0, 0);

    let tableY = costTableY + 12;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    if (data.laborCost && String(data.laborCost).trim()) {
      // Alternating row background
      pdf.setFillColor(250, 250, 250);
      pdf.rect(leftMargin, tableY, maxWidth, 10, 'F');
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(leftMargin, tableY, maxWidth, 10, 'S');

      pdf.text('Labor Charges', leftMargin + 5, tableY + 7);
      pdf.text(`₹ ${String(data.laborCost).trim()}`, pageWidth - rightMargin - 50, tableY + 7, { align: 'left' });
      tableY += 10;
    }

    if (data.partsCost && String(data.partsCost).trim()) {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(leftMargin, tableY, maxWidth, 10, 'F');
      pdf.setDrawColor(220, 220, 220);
      pdf.rect(leftMargin, tableY, maxWidth, 10, 'S');

      pdf.text('Parts & Materials', leftMargin + 5, tableY + 7);
      pdf.text(`₹ ${String(data.partsCost).trim()}`, pageWidth - rightMargin - 50, tableY + 7, { align: 'left' });
      tableY += 10;
    }

    if (data.totalCost && String(data.totalCost).trim()) {
      // Total row with professional highlight
      pdf.setFillColor(240, 245, 255);
      pdf.rect(leftMargin, tableY, maxWidth, 12, 'F');
      pdf.setDrawColor(25, 55, 130);
      pdf.setLineWidth(0.5);
      pdf.rect(leftMargin, tableY, maxWidth, 12, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(25, 55, 130);
      pdf.text('TOTAL AMOUNT', leftMargin + 5, tableY + 8);
      pdf.text(`₹ ${String(data.totalCost).trim()}`, pageWidth - rightMargin - 50, tableY + 8, { align: 'left' });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      tableY += 12;
    }

    yPosition = tableY + 8;
  }

  // ============ PHOTOS ============
  const allPhotos = [
    ...(data.clientUploadedPhotos || []).map(url => ({ url, label: 'Client Uploaded Photo' })),
    ...(data.beforePhotos || []).map(url => ({ url, label: 'Before Service Photo' })),
    ...(data.afterPhotos || []).map(url => ({ url, label: 'After Service Photo' }))
  ];

  if (allPhotos.length > 0) {
    yPosition = addSectionHeader('PHOTOGRAPHIC DOCUMENTATION');

    for (const photo of allPhotos) {
      yPosition = checkPageBreak(95);

      // Professional photo frame with label
      const frameWidth = maxWidth * 0.80;
      const frameX = leftMargin + (maxWidth - frameWidth) / 2;

      // Outer frame background
      pdf.setFillColor(248, 249, 250);
      pdf.rect(frameX - 4, yPosition - 4, frameWidth + 8, 85, 'F');

      // Photo label with professional styling
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(25, 55, 130);
      pdf.text(photo.label.toUpperCase(), frameX, yPosition + 2);
      pdf.setTextColor(0, 0, 0);
      yPosition += 8;

      try {
        const imageData = await loadImageAsBase64(photo.url);
        if (imageData) {
          const imgWidth = frameWidth;
          const imgHeight = 65;
          const imgX = frameX;

          // Professional photo border with shadow effect
          pdf.setFillColor(220, 220, 220);
          pdf.rect(imgX + 1, yPosition + 1, imgWidth, imgHeight, 'F'); // Shadow
          pdf.setFillColor(255, 255, 255);
          pdf.rect(imgX, yPosition, imgWidth, imgHeight, 'F'); // White border
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.5);
          pdf.rect(imgX, yPosition, imgWidth, imgHeight, 'S');

          // Add image with padding
          pdf.addImage(imageData, 'JPEG', imgX + 2, yPosition + 2, imgWidth - 4, imgHeight - 4);
          yPosition += imgHeight + 10;
        } else {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(9);
          pdf.setTextColor(150, 150, 150);
          pdf.text('[Image unavailable]', frameX + frameWidth / 2, yPosition + 30, { align: 'center' });
          pdf.setTextColor(0, 0, 0);
          yPosition += 65;
        }
      } catch (error) {
        console.error('Error adding image to PDF:', error);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text('[Image unavailable]', frameX + frameWidth / 2, yPosition + 30, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
        yPosition += 65;
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      yPosition += 5;
    }
    yPosition += 5;
  }

  // ============ PROFESSIONAL FOOTER ============
  const pageCount = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    // Footer separator line
    const footerY = pageHeight - 18;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(leftMargin, footerY, pageWidth - rightMargin, footerY);

    // Footer background
    pdf.setFillColor(250, 250, 252);
    pdf.rect(0, footerY, pageWidth, 18, 'F');

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(90, 90, 90);

    // Left: Company name
    pdf.text(
      'Service Hub Management System',
      leftMargin,
      footerY + 8
    );

    // Center: Page number with professional styling
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      footerY + 8,
      { align: 'center' }
    );

    // Right: Document ID
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const docId = `Doc ID: ${data.id.substring(0, 12).toUpperCase()}`;
    pdf.text(
      docId,
      pageWidth - rightMargin,
      footerY + 8,
      { align: 'right' }
    );

    // Bottom: Confidentiality notice
    pdf.setFontSize(6);
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      'CONFIDENTIAL - This document contains proprietary information',
      pageWidth / 2,
      footerY + 13,
      { align: 'center' }
    );
  }

  // Save the PDF
  pdf.save(`ServiceRequest_${data.requestNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
};
