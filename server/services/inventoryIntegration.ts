import axios from 'axios';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

interface InventoryOrderItem {
  productName: string;
  quantity: number;
  unitPrice?: number;
}

interface InventoryOrderPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: InventoryOrderItem[];
  serviceRequestNumber: string;
  notes?: string;
}

interface InventoryOrderResponse {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  message?: string;
  error?: string;
}

export interface IndentPayload {
  serviceRequestId: string;
  containerCode: string;
  companyName: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  technicianName: string;
  siteAddress: string;
  parts: { itemName: string; quantity: number }[];
}

/**
 * Service to integrate with Inventory Management System
 */
export class InventoryIntegrationService {
  private apiUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private dbUrl: string;

  constructor() {
    this.apiUrl = process.env.INVENTORY_API_URL || '';
    this.apiKey = process.env.INVENTORY_API_KEY || '';
    this.apiSecret = process.env.INVENTORY_API_SECRET || '';
    this.dbUrl = process.env.INVENTORY_SOURCE_DATABASE_URL || '';

    if ((!this.apiUrl || !this.apiKey || !this.apiSecret) && !this.dbUrl) {
      console.warn('[Inventory Integration] Missing API credentials AND Database URL in .env file');
    }
  }

  /**
   * Check if inventory integration is configured
   */
  isConfigured(): boolean {
    return !!((this.apiUrl && this.apiKey && this.apiSecret) || this.dbUrl);
  }

  /**
   * Request an Indent (Purchase Requisition) in the Inventory System
   */
  async requestIndent(payload: IndentPayload): Promise<InventoryOrderResponse> {
    // Priority 1: Use API if configured
    if (this.apiUrl && this.apiKey && this.apiSecret) {
      try {
        console.log('[Inventory Integration] Requesting indent via API:', {
          serviceRequestId: payload.serviceRequestId,
          partsCount: payload.parts.length
        });

        const response = await axios.post(
          `${this.apiUrl}/api/indent`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey,
              'X-API-Secret': this.apiSecret
            },
            timeout: 10000
          }
        );

        if (response.data && response.data.success) {
          return {
            success: true,
            orderId: response.data.orderId || response.data.inventoryOrderId,
            message: 'Indent requested successfully'
          };
        } else {
          return {
            success: false,
            error: response.data?.message || 'Failed to request indent'
          };
        }
      } catch (error: any) {
        console.error('[Inventory Integration] API Error:', error.message);
        // If API fails, don't fall back automatically to DB/Mock to avoid partial state?
        // Or we could fall back. Let's fail for now if keys present but call fails.
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Failed to request indent'
        };
      }
    }

    // Priority 2: Direct Database Insert
    if (this.dbUrl) {
      return this.createOrderDirectlyInDb(payload);
    }

    // Priority 3: Mock Response (if nothing configured)
    console.warn('[Inventory Integration] No credentials configured. Using MOCK response.');
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      orderId: `ORD-${Math.floor(Math.random() * 1000000)}`,
      orderNumber: `IND-${Date.now()}`,
      message: 'Indent requested successfully (Simulated)'
    };
  }

  private async createOrderDirectlyInDb(payload: IndentPayload): Promise<InventoryOrderResponse> {
    try {
      console.log('[Inventory DB] Creating order directly in database...');
      const sql = neon(this.dbUrl);
      
      const orderId = randomUUID();
      const orderNumber = `IND-${Date.now()}`;
      const now = new Date().toISOString();

      // Use companyName as customerName if not provided
      const customerName = payload.customerName || payload.companyName;
      const customerEmail = payload.customerEmail || '';
      const customerPhone = payload.customerPhone || '';

      // Create Order
      await sql`
        INSERT INTO orders (
          id, order_number, created_at, updated_at, 
          company_name, customer_name, customer_email, customer_phone,
          technician_name, site_address,
          service_request_id, container_code,
          status, issue_description,
          total, subtotal, tax
        ) VALUES (
          ${orderId}, ${orderNumber}, ${now}, ${now},
          ${payload.companyName}, ${customerName}, ${customerEmail}, ${customerPhone},
          ${payload.technicianName}, ${payload.siteAddress},
          ${payload.serviceRequestId}, ${payload.containerCode},
          'pending', 'Service Request Indent',
          0, 0, 0
        )
      `;

      // Insert Items
      let insertedItems = 0;
      for (const part of payload.parts) {
         // Try to find product ID by name or SKU
         const products = await sql`
            SELECT id FROM products 
            WHERE lower(name) = lower(${part.itemName}) 
            OR lower(sku) = lower(${part.itemName})
            LIMIT 1
         `;
         
         let productId = products.length > 0 ? products[0].id : null;
         
         if (productId) {
           await sql`
             INSERT INTO order_items (
               id, order_id, product_id, quantity, unit_price, total_price
             ) VALUES (
               ${randomUUID()}, ${orderId}, ${productId}, ${part.quantity}, 0, 0
             )
           `;
           insertedItems++;
         } else {
           console.warn(`[Inventory DB] Product not found: ${part.itemName} - Skipping item`);
         }
      }

      console.log(`[Inventory DB] Order ${orderNumber} created with ${insertedItems} items.`);

      return {
        success: true,
        orderId: orderId,
        orderNumber: orderNumber,
        message: 'Order created directly in Inventory Database'
      };

    } catch (error: any) {
      console.error('[Inventory DB] Error creating order:', error);
      return {
        success: false,
        error: error.message || 'Database insert failed'
      };
    }
  }

  /**
   * Create an order in the Inventory Management System
   */
  async createOrder(payload: InventoryOrderPayload): Promise<InventoryOrderResponse> {
    if (!this.isConfigured()) {
      console.error('[Inventory Integration] API credentials not configured');
      return {
        success: false,
        error: 'Inventory API credentials not configured'
      };
    }

    try {
      console.log('[Inventory Integration] Creating order:', {
        serviceRequestNumber: payload.serviceRequestNumber,
        customerName: payload.customerName,
        itemCount: payload.items.length
      });

      const response = await axios.post(
        `${this.apiUrl}/api/orders`,
        {
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          customerPhone: payload.customerPhone,
          items: payload.items,
          source: 'service_request',
          sourceReference: payload.serviceRequestNumber,
          notes: payload.notes || `Auto-created from Service Request: ${payload.serviceRequestNumber}`,
          status: 'needs_approval',
          total: 0.00 // Will be calculated by inventory system
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
            'X-API-Secret': this.apiSecret
          },
          timeout: 10000 // 10 second timeout
        }
      );

      if (response.data && response.data.success) {
        console.log('[Inventory Integration] ✅ Order created successfully:', {
          orderId: response.data.orderId || response.data.id,
          orderNumber: response.data.orderNumber
        });

        return {
          success: true,
          orderId: response.data.orderId || response.data.id,
          orderNumber: response.data.orderNumber,
          message: 'Order created successfully in Inventory System'
        };
      } else {
        console.error('[Inventory Integration] ❌ Order creation failed:', response.data);
        return {
          success: false,
          error: response.data?.message || 'Failed to create order'
        };
      }
    } catch (error: any) {
      console.error('[Inventory Integration] ❌ Error creating order:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to create order in Inventory System'
      };
    }
  }

  /**
   * Check if an order already exists for a service request
   */
  async checkExistingOrder(serviceRequestNumber: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/api/orders/check`,
        {
          params: {
            sourceReference: serviceRequestNumber
          },
          headers: {
            'X-API-Key': this.apiKey,
            'X-API-Secret': this.apiSecret
          },
          timeout: 5000
        }
      );

      return response.data?.exists || false;
    } catch (error: any) {
      console.error('[Inventory Integration] Error checking existing order:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export const inventoryService = new InventoryIntegrationService();
