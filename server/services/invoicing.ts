import { storage } from '../storage';

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  lineItems: InvoiceLineItem[];
  taxRate: number;
  paymentTerms: string;
  dueDays: number;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category: 'labor' | 'parts' | 'travel' | 'other';
}

export interface InvoiceData {
  serviceRequestId: string;
  customerId: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  dueDate: Date;
  paymentTerms: string;
}

class InvoicingService {
  private templates: Map<string, InvoiceTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize invoice templates
   */
  private initializeTemplates(): void {
    // Standard service template
    this.templates.set('standard_service', {
      id: 'standard_service',
      name: 'Standard Container Service',
      description: 'Container maintenance and repair service',
      lineItems: [
        {
          description: 'Service Labor',
          quantity: 1,
          unitPrice: 0, // Will be calculated based on technician rate
          amount: 0,
          category: 'labor'
        },
        {
          description: 'Travel Time',
          quantity: 1,
          unitPrice: 0, // Will be calculated
          amount: 0,
          category: 'travel'
        }
      ],
      taxRate: 0.18, // 18% GST
      paymentTerms: 'net30',
      dueDays: 30
    });

    // Emergency service template
    this.templates.set('emergency_service', {
      id: 'emergency_service',
      name: 'Emergency Container Service',
      description: 'Urgent container repair service',
      lineItems: [
        {
          description: 'Emergency Service Labor',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          category: 'labor'
        },
        {
          description: 'Emergency Travel',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          category: 'travel'
        },
        {
          description: 'Emergency Surcharge',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          category: 'other'
        }
      ],
      taxRate: 0.18,
      paymentTerms: 'net15',
      dueDays: 15
    });

    // Parts replacement template
    this.templates.set('parts_replacement', {
      id: 'parts_replacement',
      name: 'Container Parts Replacement',
      description: 'Replacement of container components',
      lineItems: [
        {
          description: 'Replacement Parts',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          category: 'parts'
        },
        {
          description: 'Installation Labor',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          category: 'labor'
        }
      ],
      taxRate: 0.18,
      paymentTerms: 'net30',
      dueDays: 30
    });
  }

  /**
   * Generate invoice for a completed service request
   */
  async generateInvoice(serviceRequestId: string): Promise<any> {
    try {
      const serviceRequest = await storage.getServiceRequest(serviceRequestId);
      if (!serviceRequest) {
        throw new Error('Service request not found');
      }

      if (serviceRequest.status !== 'completed') {
        throw new Error('Service request must be completed to generate invoice');
      }

      const customer = await storage.getCustomer(serviceRequest.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const technician = serviceRequest.assignedTechnicianId 
        ? await storage.getTechnician(serviceRequest.assignedTechnicianId)
        : null;

      // Determine template based on service type
      const template = this.selectTemplate(serviceRequest);
      
      // Calculate line items
      const lineItems = await this.calculateLineItems(serviceRequest, technician, template);
      
      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = subtotal * template.taxRate;
      const totalAmount = subtotal + taxAmount;

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber();

      // Create invoice data
      const invoiceData: InvoiceData = {
        serviceRequestId,
        customerId: serviceRequest.customerId,
        lineItems,
        subtotal,
        taxRate: template.taxRate,
        taxAmount,
        totalAmount,
        dueDate: new Date(Date.now() + template.dueDays * 24 * 60 * 60 * 1000),
        paymentTerms: template.paymentTerms
      };

      // Create invoice in database
      const invoice = await storage.createInvoice({
        invoiceNumber,
        serviceRequestId,
        customerId: serviceRequest.customerId,
        issueDate: new Date(),
        dueDate: invoiceData.dueDate,
        lineItems: lineItems,
        subtotal: subtotal.toString(),
        taxRate: template.taxRate.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paymentStatus: 'pending',
        amountPaid: '0.00'
      });

      // Update service request with invoice reference
      await storage.updateServiceRequest(serviceRequestId, {
        invoiceId: invoice.id
      });

      return invoice;

    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  }

  /**
   * Select appropriate template based on service request
   */
  private selectTemplate(serviceRequest: any): InvoiceTemplate {
    if (serviceRequest.priority === 'urgent') {
      return this.templates.get('emergency_service')!;
    }
    
    if (serviceRequest.usedParts && serviceRequest.usedParts.length > 0) {
      return this.templates.get('parts_replacement')!;
    }
    
    return this.templates.get('standard_service')!;
  }

  /**
   * Calculate line items for invoice
   */
  private async calculateLineItems(
    serviceRequest: any,
    technician: any,
    template: InvoiceTemplate
  ): Promise<InvoiceLineItem[]> {
    const lineItems: InvoiceLineItem[] = [];

    for (const templateItem of template.lineItems) {
      const lineItem: InvoiceLineItem = {
        ...templateItem,
        quantity: templateItem.quantity,
        unitPrice: 0,
        amount: 0
      };

      switch (templateItem.category) {
        case 'labor':
          lineItem.unitPrice = technician?.hourlyRate || 500; // Default rate
          lineItem.quantity = this.calculateServiceHours(serviceRequest);
          lineItem.amount = lineItem.unitPrice * lineItem.quantity;
          break;

        case 'travel':
          lineItem.unitPrice = 50; // Travel rate per hour
          lineItem.quantity = this.calculateTravelHours(serviceRequest);
          lineItem.amount = lineItem.unitPrice * lineItem.quantity;
          break;

        case 'parts':
          lineItem.unitPrice = this.calculatePartsCost(serviceRequest);
          lineItem.quantity = 1;
          lineItem.amount = lineItem.unitPrice;
          break;

        case 'other':
          if (serviceRequest.priority === 'urgent') {
            lineItem.unitPrice = 1000; // Emergency surcharge
            lineItem.quantity = 1;
            lineItem.amount = lineItem.unitPrice;
          }
          break;
      }

      if (lineItem.amount > 0) {
        lineItems.push(lineItem);
      }
    }

    return lineItems;
  }

  /**
   * Calculate service hours
   */
  private calculateServiceHours(serviceRequest: any): number {
    if (serviceRequest.serviceDuration) {
      return serviceRequest.serviceDuration / 60; // Convert minutes to hours
    }
    
    if (serviceRequest.estimatedDuration) {
      return serviceRequest.estimatedDuration / 60;
    }
    
    return 1; // Default 1 hour
  }

  /**
   * Calculate travel hours
   */
  private calculateTravelHours(serviceRequest: any): number {
    // This would integrate with mapping service
    // For now, return mock data
    return 0.5; // 30 minutes default
  }

  /**
   * Calculate parts cost
   */
  private calculatePartsCost(serviceRequest: any): number {
    if (!serviceRequest.usedParts || serviceRequest.usedParts.length === 0) {
      return 0;
    }

    // This would integrate with inventory system
    // For now, return mock cost
    return serviceRequest.usedParts.length * 200; // 200 per part
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get count of invoices for this month
    const invoices = await storage.getAllInvoices();
    const monthlyInvoices = invoices.filter(inv => 
      inv.invoiceNumber.startsWith(`INV-${year}${month}`)
    );
    
    const sequence = String(monthlyInvoices.length + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Process payment for invoice
   */
  async processPayment(
    invoiceId: string,
    amount: number,
    paymentMethod: string,
    paymentReference: string
  ): Promise<any> {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const newAmountPaid = parseFloat(invoice.amountPaid || '0') + amount;
      const totalAmount = parseFloat(invoice.totalAmount);

      let paymentStatus = 'partially_paid';
      if (newAmountPaid >= totalAmount) {
        paymentStatus = 'paid';
      }

      const updatedInvoice = await storage.updateInvoice(invoiceId, {
        amountPaid: newAmountPaid.toString(),
        paymentStatus: paymentStatus as any,
        paymentDate: new Date(),
        paymentMethod,
        paymentReference
      });

      return updatedInvoice;

    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Generate invoice PDF (template for future implementation)
   */
  async generateInvoicePDF(invoiceId: string): Promise<string> {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // This would integrate with a PDF generation service
      // For now, return a placeholder URL
      const pdfUrl = `https://container-genie.com/invoices/${invoiceId}.pdf`;
      
      // Update invoice with PDF URL
      await storage.updateInvoice(invoiceId, {
        pdfUrl
      });

      return pdfUrl;

    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw error;
    }
  }

  /**
   * Send invoice to customer
   */
  async sendInvoiceToCustomer(invoiceId: string): Promise<void> {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Generate PDF
      const pdfUrl = await this.generateInvoicePDF(invoiceId);

      // Send via WhatsApp (template for future implementation)
      // This would integrate with WhatsApp service
      console.log(`Invoice ${invoice.invoiceNumber} sent to customer ${customer.email}`);
      console.log(`PDF URL: ${pdfUrl}`);

      // Update invoice as sent
      await storage.updateInvoice(invoiceId, {
        sentAt: new Date()
      });

    } catch (error) {
      console.error('Error sending invoice to customer:', error);
      throw error;
    }
  }

  /**
   * Get invoice analytics
   */
  async getInvoiceAnalytics(period: 'month' | 'quarter' | 'year' = 'month'): Promise<any> {
    try {
      const invoices = await storage.getAllInvoices();
      const now = new Date();
      
      let startDate: Date;
      switch (period) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      const periodInvoices = invoices.filter(inv => 
        new Date(inv.issueDate) >= startDate
      );

      const totalAmount = periodInvoices.reduce((sum, inv) => 
        sum + parseFloat(inv.totalAmount), 0
      );

      const paidAmount = periodInvoices.reduce((sum, inv) => 
        sum + parseFloat(inv.amountPaid || '0'), 0
      );

      const pendingAmount = totalAmount - paidAmount;

      return {
        period,
        totalInvoices: periodInvoices.length,
        totalAmount,
        paidAmount,
        pendingAmount,
        averageInvoiceValue: periodInvoices.length > 0 ? totalAmount / periodInvoices.length : 0,
        paymentRate: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0
      };

    } catch (error) {
      console.error('Error getting invoice analytics:', error);
      throw error;
    }
  }
}

// Export singleton instance
let invoicingService: InvoicingService | null = null;

export function getInvoicingService(): InvoicingService {
  if (!invoicingService) {
    invoicingService = new InvoicingService();
  }
  return invoicingService;
}

// Export functions for easy use
export async function generateInvoice(serviceRequestId: string): Promise<any> {
  const service = getInvoicingService();
  return await service.generateInvoice(serviceRequestId);
}

export async function processPayment(invoiceId: string, amount: number, paymentMethod: string, paymentReference: string): Promise<any> {
  const service = getInvoicingService();
  return await service.processPayment(invoiceId, amount, paymentMethod, paymentReference);
}

export async function sendInvoiceToCustomer(invoiceId: string): Promise<void> {
  const service = getInvoicingService();
  return await service.sendInvoiceToCustomer(invoiceId);
}

export async function getInvoiceAnalytics(period: 'month' | 'quarter' | 'year' = 'month'): Promise<any> {
  const service = getInvoicingService();
  return await service.getInvoiceAnalytics(period);
}
