-- Enable WhatsApp for Crystal Group (+918218994855)
-- Run this SQL script to enable WhatsApp for existing client

-- Step 1: Find the user ID for Crystal Group
SELECT 
  u.id as user_id,
  u.phoneNumber,
  u.name,
  u.whatsappVerified,
  c.companyName,
  c.id as customer_id
FROM users u
JOIN customers c ON c.userId = u.id
WHERE c.companyName = 'Crystal Group' 
  OR u.phoneNumber IN ('918218994855', '8218994855', '+918218994855');

-- Step 2: Enable WhatsApp for this user
UPDATE users 
SET whatsappVerified = true
WHERE id IN (
  SELECT u.id 
  FROM users u
  JOIN customers c ON c.userId = u.id
  WHERE c.companyName = 'Crystal Group' 
    OR u.phoneNumber IN ('918218994855', '8218994855', '+918218994855')
);

-- Step 3: Verify the update
SELECT 
  u.id,
  u.phoneNumber,
  u.name,
  u.role,
  u.isActive,
  u.whatsappVerified,
  c.companyName,
  c.whatsappNumber
FROM users u
JOIN customers c ON c.userId = u.id
WHERE c.companyName = 'Crystal Group';

-- Expected result:
-- whatsappVerified should be TRUE
-- role should be 'client'
-- isActive should be TRUE
