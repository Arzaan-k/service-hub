import axios from 'axios';

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

/**
 * Service to integrate with Inventory Management System
 */
export class InventoryIntegrationService {
  private apiUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiUrl = process.env.INVENTORY_API_URL || '';
    this.apiKey = process.env.INVENTORY_API_KEY || '';
    this.apiSecret = process.env.INVENTORY_API_SECRET || '';

    if (!this.apiUrl || !this.apiKey || !this.apiSecret) {
      console.warn('[Inventory Integration] Missing API credentials in .env file');
    }
  }

  /**
   * Check if inventory integration is configured
   */
  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey && this.apiSecret);
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
