-- Fix Duplicate User Issue for +918218994855
-- This script removes the duplicate technician user and keeps only the client user

-- Step 1: Check for duplicate users
SELECT 
  id,
  phoneNumber,
  name,
  email,
  role,
  isActive,
  whatsappVerified,
  createdAt
FROM users 
WHERE phoneNumber IN ('918218994855', '+918218994855', '8218994855')
ORDER BY createdAt;

-- Expected: You should see 2 users
-- 1. 918218994855 - WhatsApp User - technician (older)
-- 2. +918218994855 - Jawad - client (newer)

-- Step 2: Find which user has the customer profile
SELECT 
  u.id as user_id,
  u.phoneNumber,
  u.name,
  u.role,
  c.id as customer_id,
  c.companyName
FROM users u
LEFT JOIN customers c ON c.userId = u.id
WHERE u.phoneNumber IN ('918218994855', '+918218994855', '8218994855')
ORDER BY u.createdAt;

-- Step 3: Delete the technician user (918218994855) if it has no customer profile
-- IMPORTANT: Only run this if the technician user has no customer profile!
DELETE FROM users 
WHERE phoneNumber = '918218994855' 
  AND role = 'technician'
  AND id NOT IN (SELECT userId FROM customers WHERE userId IS NOT NULL);

-- Step 4: Verify only one user remains
SELECT 
  u.id,
  u.phoneNumber,
  u.name,
  u.role,
  u.whatsappVerified,
  c.companyName
FROM users u
LEFT JOIN customers c ON c.userId = u.id
WHERE u.phoneNumber IN ('918218994855', '+918218994855', '8218994855');

-- Expected: Only 1 user (Jawad - client - Crystal Group)

-- Step 5: Enable WhatsApp for the client user (if not already enabled)
UPDATE users 
SET whatsappVerified = true
WHERE phoneNumber = '+918218994855' 
  AND role = 'client';

-- Step 6: Final verification
SELECT 
  u.id,
  u.phoneNumber,
  u.name,
  u.role,
  u.isActive,
  u.whatsappVerified,
  c.companyName,
  c.whatsappNumber,
  (SELECT COUNT(*) FROM containers WHERE currentCustomerId = c.id) as container_count
FROM users u
JOIN customers c ON c.userId = u.id
WHERE u.phoneNumber IN ('918218994855', '+918218994855', '8218994855');

-- Expected result:
-- phoneNumber: +918218994855
-- name: Jawad
-- role: client
-- isActive: true
-- whatsappVerified: true
-- companyName: Crystal Group
-- container_count: 2 (TDRU7152244, TRIU6617292)
