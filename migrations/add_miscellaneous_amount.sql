-- Add miscellaneous_amount column to technician_trips table
ALTER TABLE technician_trips 
ADD COLUMN IF NOT EXISTS miscellaneous_amount DECIMAL(10, 2) DEFAULT 0.00;
