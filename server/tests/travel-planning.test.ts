/**
 * Unit tests for Technician Travel Planning API endpoints
 * 
 * Run with: tsx server/tests/travel-planning.test.ts
 * 
 * Note: These tests require a running database connection.
 * Set DATABASE_URL in your .env file before running.
 */

import { describe, it, expect, beforeAll, afterAll } from './test-utils';
import { storage } from '../storage';
import { db } from '../db';
import { technicianTrips, technicianTripCosts, technicianTripTasks, technicians, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Mock data
const mockTechnicianId = 'test-technician-id';
const mockUserId = 'test-user-id';
const mockTripData = {
  technicianId: mockTechnicianId,
  origin: 'Mumbai',
  destinationCity: 'Chennai',
  startDate: new Date('2025-12-01'),
  endDate: new Date('2025-12-05'),
  dailyWorkingTimeWindow: '10:00-18:00',
  purpose: 'pm' as const,
  notes: 'Test trip notes',
  tripStatus: 'planned' as const,
  bookingStatus: 'not_started' as const,
  createdBy: mockUserId,
};

describe('Travel Planning Storage Methods', () => {
  let createdTripId: string;
  let createdCostsId: string;
  let createdTaskId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(technicianTripTasks).where(eq(technicianTripTasks.tripId, 'test-trip-id'));
    await db.delete(technicianTripCosts).where(eq(technicianTripCosts.tripId, 'test-trip-id'));
    await db.delete(technicianTrips).where(eq(technicianTrips.id, 'test-trip-id'));
  });

  afterAll(async () => {
    // Clean up test data
    if (createdTaskId) {
      await db.delete(technicianTripTasks).where(eq(technicianTripTasks.id, createdTaskId));
    }
    if (createdCostsId) {
      await db.delete(technicianTripCosts).where(eq(technicianTripCosts.id, createdCostsId));
    }
    if (createdTripId) {
      await db.delete(technicianTrips).where(eq(technicianTrips.id, createdTripId));
    }
  });

  describe('createTechnicianTrip', () => {
    it('should create a new technician trip', async () => {
      const trip = await storage.createTechnicianTrip(mockTripData);
      expect(trip).toBeDefined();
      expect(trip.technicianId).toBe(mockTripData.technicianId);
      expect(trip.destinationCity).toBe(mockTripData.destinationCity);
      expect(trip.tripStatus).toBe('planned');
      createdTripId = trip.id;
    });

    it('should fail with invalid dates', async () => {
      const invalidData = {
        ...mockTripData,
        endDate: new Date('2025-11-01'), // Before startDate
      };
      // Note: Database constraint should prevent this, but we test the application logic
      await expect(
        storage.createTechnicianTrip(invalidData)
      ).rejects.toThrow();
    });
  });

  describe('getTechnicianTrip', () => {
    it('should retrieve a trip by ID', async () => {
      if (!createdTripId) {
        const trip = await storage.createTechnicianTrip(mockTripData);
        createdTripId = trip.id;
      }
      const trip = await storage.getTechnicianTrip(createdTripId);
      expect(trip).toBeDefined();
      expect(trip?.id).toBe(createdTripId);
    });

    it('should return undefined for non-existent trip', async () => {
      const trip = await storage.getTechnicianTrip('non-existent-id');
      expect(trip).toBeUndefined();
    });
  });

  describe('getTechnicianTrips', () => {
    it('should retrieve trips with filters', async () => {
      const trips = await storage.getTechnicianTrips({
        destinationCity: 'Chennai',
        tripStatus: 'planned',
      });
      expect(Array.isArray(trips)).toBe(true);
    });

    it('should filter by technician ID', async () => {
      const trips = await storage.getTechnicianTrips({
        technicianId: mockTechnicianId,
      });
      expect(trips.every(t => t.technicianId === mockTechnicianId)).toBe(true);
    });

    it('should filter by date range', async () => {
      const trips = await storage.getTechnicianTrips({
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-12-31'),
      });
      expect(Array.isArray(trips)).toBe(true);
    });
  });

  describe('updateTechnicianTrip', () => {
    it('should update trip fields', async () => {
      if (!createdTripId) {
        const trip = await storage.createTechnicianTrip(mockTripData);
        createdTripId = trip.id;
      }
      const updated = await storage.updateTechnicianTrip(createdTripId, {
        tripStatus: 'booked',
        bookingStatus: 'tickets_booked',
      });
      expect(updated.tripStatus).toBe('booked');
      expect(updated.bookingStatus).toBe('tickets_booked');
    });
  });

  describe('deleteTechnicianTrip', () => {
    it('should soft delete (cancel) a trip', async () => {
      const trip = await storage.createTechnicianTrip(mockTripData);
      await storage.deleteTechnicianTrip(trip.id);
      const deleted = await storage.getTechnicianTrip(trip.id);
      expect(deleted?.tripStatus).toBe('cancelled');
    });
  });

  describe('updateTechnicianTripCosts', () => {
    it('should create and update trip costs', async () => {
      if (!createdTripId) {
        const trip = await storage.createTechnicianTrip(mockTripData);
        createdTripId = trip.id;
      }
      const costs = await storage.updateTechnicianTripCosts(createdTripId, {
        travelFare: '5000',
        stayCost: '4000',
        dailyAllowance: '1500',
        localTravelCost: '2000',
        miscCost: '500',
        currency: 'INR',
      });
      expect(costs).toBeDefined();
      expect(parseFloat(costs.totalEstimatedCost)).toBe(13000); // 5000 + 4000 + 1500 + 2000 + 500
      createdCostsId = costs.id;
    });

    it('should auto-calculate total estimated cost', async () => {
      if (!createdTripId) {
        const trip = await storage.createTechnicianTrip(mockTripData);
        createdTripId = trip.id;
      }
      const costs = await storage.updateTechnicianTripCosts(createdTripId, {
        travelFare: '1000',
        stayCost: '2000',
        dailyAllowance: '500',
        localTravelCost: '300',
        miscCost: '200',
      });
      const total = parseFloat(costs.totalEstimatedCost);
      expect(total).toBe(4000); // 1000 + 2000 + 500 + 300 + 200
    });
  });

  describe('getTechnicianTripCosts', () => {
    it('should retrieve costs for a trip', async () => {
      if (!createdTripId) {
        const trip = await storage.createTechnicianTrip(mockTripData);
        createdTripId = trip.id;
        await storage.updateTechnicianTripCosts(createdTripId, {
          travelFare: '1000',
          stayCost: '2000',
        });
      }
      const costs = await storage.getTechnicianTripCosts(createdTripId);
      expect(costs).toBeDefined();
      expect(costs?.tripId).toBe(createdTripId);
    });
  });

  describe('createTechnicianTripTask', () => {
    it('should create a trip task', async () => {
      if (!createdTripId) {
        const trip = await storage.createTechnicianTrip(mockTripData);
        createdTripId = trip.id;
      }
      const task = await storage.createTechnicianTripTask({
        tripId: createdTripId,
        containerId: 'test-container-id',
        siteName: 'Test Site',
        taskType: 'pm',
        priority: 'normal',
        scheduledDate: new Date('2025-12-02'),
        estimatedDurationHours: 2,
        status: 'pending',
      });
      expect(task).toBeDefined();
      expect(task.tripId).toBe(createdTripId);
      createdTaskId = task.id;
    });
  });

  describe('getTechnicianTripTasks', () => {
    it('should retrieve all tasks for a trip', async () => {
      if (!createdTripId) {
        const trip = await storage.createTechnicianTrip(mockTripData);
        createdTripId = trip.id;
      }
      const tasks = await storage.getTechnicianTripTasks(createdTripId);
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('updateTechnicianTripTask', () => {
    it('should update a trip task', async () => {
      if (!createdTaskId) {
        if (!createdTripId) {
          const trip = await storage.createTechnicianTrip(mockTripData);
          createdTripId = trip.id;
        }
        const task = await storage.createTechnicianTripTask({
          tripId: createdTripId,
          containerId: 'test-container-id',
          taskType: 'pm',
          status: 'pending',
        });
        createdTaskId = task.id;
      }
      const updated = await storage.updateTechnicianTripTask(createdTaskId, {
        status: 'completed',
        completedAt: new Date(),
      });
      expect(updated.status).toBe('completed');
    });
  });
});

// Simple test runner (if no test framework is available)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Travel Planning API tests...');
  console.log('Note: These tests require a database connection.');
  console.log('Make sure DATABASE_URL is set in your .env file.\n');
  
  // Run tests
  const runTests = async () => {
    try {
      // Basic connectivity test
      const testTrip = await storage.createTechnicianTrip({
        ...mockTripData,
        technicianId: 'test-tech-' + Date.now(),
      });
      console.log('✅ Storage methods are working');
      console.log('✅ Created test trip:', testTrip.id);
      
      // Clean up
      await storage.deleteTechnicianTrip(testTrip.id);
      console.log('✅ Test cleanup successful');
      
      console.log('\n✅ All basic tests passed!');
      console.log('For full test suite, use a proper test framework like Jest or Vitest.');
    } catch (error: any) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  };
  
  runTests();
}

