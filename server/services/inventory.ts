import { storage } from '../storage';

export interface InventoryItem {
  id: string;
  partNumber: string;
  partName: string;
  category: string;
  quantityInStock: number;
  reorderLevel: number;
  unitPrice: number;
  location: string;
  description?: string;
  supplier?: string;
  lastUpdated: Date;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  reference?: string; // Service request ID, purchase order, etc.
  timestamp: Date;
  userId: string;
}

export interface ReorderAlert {
  itemId: string;
  partNumber: string;
  partName: string;
  currentStock: number;
  reorderLevel: number;
  suggestedOrderQuantity: number;
  urgency: 'low' | 'medium' | 'high';
}

class InventoryService {
  /**
   * Get all inventory items
   */
  async getAllItems(): Promise<InventoryItem[]> {
    try {
      const items = await storage.getAllInventoryItems();
      return items.map(item => ({
        ...item,
        lastUpdated: new Date(item.updatedAt)
      }));
    } catch (error) {
      console.error('Error getting inventory items:', error);
      throw error;
    }
  }

  /**
   * Get inventory item by ID
   */
  async getItem(itemId: string): Promise<InventoryItem | null> {
    try {
      const item = await storage.getInventoryItem(itemId);
      if (!item) return null;
      
      return {
        ...item,
        lastUpdated: new Date(item.updatedAt)
      };
    } catch (error) {
      console.error('Error getting inventory item:', error);
      throw error;
    }
  }

  /**
   * Create new inventory item
   */
  async createItem(itemData: Omit<InventoryItem, 'id' | 'lastUpdated'>): Promise<InventoryItem> {
    try {
      const item = await storage.createInventoryItem({
        ...itemData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return {
        ...item,
        lastUpdated: new Date(item.updatedAt)
      };
    } catch (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }
  }

  /**
   * Update inventory item
   */
  async updateItem(itemId: string, itemData: Partial<InventoryItem>): Promise<InventoryItem> {
    try {
      const item = await storage.updateInventoryItem(itemId, {
        ...itemData,
        updatedAt: new Date()
      });

      return {
        ...item,
        lastUpdated: new Date(item.updatedAt)
      };
    } catch (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }
  }

  /**
   * Delete inventory item
   */
  async deleteItem(itemId: string): Promise<void> {
    try {
      await storage.deleteInventoryItem(itemId);
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  }

  /**
   * Add stock to inventory
   */
  async addStock(
    itemId: string,
    quantity: number,
    reason: string,
    userId: string,
    reference?: string
  ): Promise<InventoryTransaction> {
    try {
      const item = await this.getItem(itemId);
      if (!item) {
        throw new Error('Inventory item not found');
      }

      const newQuantity = item.quantityInStock + quantity;
      
      // Update item quantity
      await this.updateItem(itemId, { quantityInStock: newQuantity });

      // Create transaction record
      const transaction = await this.createTransaction({
        itemId,
        type: 'in',
        quantity,
        reason,
        reference,
        userId
      });

      return transaction;
    } catch (error) {
      console.error('Error adding stock:', error);
      throw error;
    }
  }

  /**
   * Remove stock from inventory
   */
  async removeStock(
    itemId: string,
    quantity: number,
    reason: string,
    userId: string,
    reference?: string
  ): Promise<InventoryTransaction> {
    try {
      const item = await this.getItem(itemId);
      if (!item) {
        throw new Error('Inventory item not found');
      }

      if (item.quantityInStock < quantity) {
        throw new Error('Insufficient stock');
      }

      const newQuantity = item.quantityInStock - quantity;
      
      // Update item quantity
      await this.updateItem(itemId, { quantityInStock: newQuantity });

      // Create transaction record
      const transaction = await this.createTransaction({
        itemId,
        type: 'out',
        quantity,
        reason,
        reference,
        userId
      });

      return transaction;
    } catch (error) {
      console.error('Error removing stock:', error);
      throw error;
    }
  }

  /**
   * Adjust stock (for corrections, damage, etc.)
   */
  async adjustStock(
    itemId: string,
    newQuantity: number,
    reason: string,
    userId: string,
    reference?: string
  ): Promise<InventoryTransaction> {
    try {
      const item = await this.getItem(itemId);
      if (!item) {
        throw new Error('Inventory item not found');
      }

      const adjustment = newQuantity - item.quantityInStock;
      
      // Update item quantity
      await this.updateItem(itemId, { quantityInStock: newQuantity });

      // Create transaction record
      const transaction = await this.createTransaction({
        itemId,
        type: 'adjustment',
        quantity: Math.abs(adjustment),
        reason,
        reference,
        userId
      });

      return transaction;
    } catch (error) {
      console.error('Error adjusting stock:', error);
      throw error;
    }
  }

  /**
   * Create inventory transaction
   */
  private async createTransaction(transactionData: Omit<InventoryTransaction, 'id' | 'timestamp'>): Promise<InventoryTransaction> {
    try {
      const transaction = await storage.createInventoryTransaction({
        ...transactionData,
        timestamp: new Date()
      });

      return {
        ...transaction,
        timestamp: new Date(transaction.timestamp)
      };
    } catch (error) {
      console.error('Error creating inventory transaction:', error);
      throw error;
    }
  }

  /**
   * Get inventory transactions
   */
  async getTransactions(itemId?: string, limit: number = 100): Promise<InventoryTransaction[]> {
    try {
      const transactions = await storage.getInventoryTransactions(itemId, limit);
      return transactions.map(t => ({
        ...t,
        timestamp: new Date(t.timestamp)
      }));
    } catch (error) {
      console.error('Error getting inventory transactions:', error);
      throw error;
    }
  }

  /**
   * Check for reorder alerts
   */
  async getReorderAlerts(): Promise<ReorderAlert[]> {
    try {
      const items = await this.getAllItems();
      const alerts: ReorderAlert[] = [];

      for (const item of items) {
        if (item.quantityInStock <= item.reorderLevel) {
          const suggestedOrderQuantity = Math.max(
            item.reorderLevel * 2, // Order 2x reorder level
            item.reorderLevel - item.quantityInStock + 10 // Or enough to cover current shortage + buffer
          );

          let urgency: 'low' | 'medium' | 'high' = 'low';
          if (item.quantityInStock === 0) {
            urgency = 'high';
          } else if (item.quantityInStock <= item.reorderLevel * 0.5) {
            urgency = 'medium';
          }

          alerts.push({
            itemId: item.id,
            partNumber: item.partNumber,
            partName: item.partName,
            currentStock: item.quantityInStock,
            reorderLevel: item.reorderLevel,
            suggestedOrderQuantity,
            urgency
          });
        }
      }

      return alerts.sort((a, b) => {
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      });
    } catch (error) {
      console.error('Error getting reorder alerts:', error);
      throw error;
    }
  }

  /**
   * Get inventory analytics
   */
  async getInventoryAnalytics(): Promise<any> {
    try {
      const items = await this.getAllItems();
      const transactions = await this.getTransactions();

      const totalItems = items.length;
      const totalValue = items.reduce((sum, item) => sum + (item.quantityInStock * item.unitPrice), 0);
      const lowStockItems = items.filter(item => item.quantityInStock <= item.reorderLevel).length;
      const outOfStockItems = items.filter(item => item.quantityInStock === 0).length;

      // Category breakdown
      const categoryBreakdown = items.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Recent transactions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentTransactions = transactions.filter(t => t.timestamp >= thirtyDaysAgo);

      return {
        totalItems,
        totalValue: Math.round(totalValue * 100) / 100,
        lowStockItems,
        outOfStockItems,
        categoryBreakdown,
        recentTransactions: recentTransactions.length,
        averageItemValue: totalItems > 0 ? Math.round((totalValue / totalItems) * 100) / 100 : 0
      };
    } catch (error) {
      console.error('Error getting inventory analytics:', error);
      throw error;
    }
  }

  /**
   * Search inventory items
   */
  async searchItems(query: string): Promise<InventoryItem[]> {
    try {
      const items = await this.getAllItems();
      const searchTerm = query.toLowerCase();

      return items.filter(item => 
        item.partNumber.toLowerCase().includes(searchTerm) ||
        item.partName.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm) ||
        (item.description && item.description.toLowerCase().includes(searchTerm))
      );
    } catch (error) {
      console.error('Error searching inventory items:', error);
      throw error;
    }
  }

  /**
   * Get items by category
   */
  async getItemsByCategory(category: string): Promise<InventoryItem[]> {
    try {
      const items = await this.getAllItems();
      return items.filter(item => item.category.toLowerCase() === category.toLowerCase());
    } catch (error) {
      console.error('Error getting items by category:', error);
      throw error;
    }
  }

  /**
   * Check if item is available for service request
   */
  async checkAvailability(itemId: string, requiredQuantity: number): Promise<boolean> {
    try {
      const item = await this.getItem(itemId);
      if (!item) return false;
      
      return item.quantityInStock >= requiredQuantity;
    } catch (error) {
      console.error('Error checking item availability:', error);
      return false;
    }
  }

  /**
   * Reserve items for service request
   */
  async reserveItems(serviceRequestId: string, items: { itemId: string; quantity: number }[]): Promise<boolean> {
    try {
      // Check availability for all items
      for (const item of items) {
        const available = await this.checkAvailability(item.itemId, item.quantity);
        if (!available) {
          return false;
        }
      }

      // Reserve items (reduce stock)
      for (const item of items) {
        await this.removeStock(
          item.itemId,
          item.quantity,
          `Reserved for service request ${serviceRequestId}`,
          'system',
          serviceRequestId
        );
      }

      return true;
    } catch (error) {
      console.error('Error reserving items:', error);
      return false;
    }
  }

  /**
   * Release reserved items
   */
  async releaseItems(serviceRequestId: string, items: { itemId: string; quantity: number }[]): Promise<void> {
    try {
      for (const item of items) {
        await this.addStock(
          item.itemId,
          item.quantity,
          `Released from service request ${serviceRequestId}`,
          'system',
          serviceRequestId
        );
      }
    } catch (error) {
      console.error('Error releasing items:', error);
      throw error;
    }
  }
}

// Export singleton instance
let inventoryService: InventoryService | null = null;

export function getInventoryService(): InventoryService {
  if (!inventoryService) {
    inventoryService = new InventoryService();
  }
  return inventoryService;
}

// Export functions for easy use
export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  const service = getInventoryService();
  return await service.getAllItems();
}

export async function getInventoryItem(itemId: string): Promise<InventoryItem | null> {
  const service = getInventoryService();
  return await service.getItem(itemId);
}

export async function createInventoryItem(itemData: Omit<InventoryItem, 'id' | 'lastUpdated'>): Promise<InventoryItem> {
  const service = getInventoryService();
  return await service.createItem(itemData);
}

export async function getReorderAlerts(): Promise<ReorderAlert[]> {
  const service = getInventoryService();
  return await service.getReorderAlerts();
}

export async function getInventoryAnalytics(): Promise<any> {
  const service = getInventoryService();
  return await service.getInventoryAnalytics();
}
