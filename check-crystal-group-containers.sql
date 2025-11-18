-- Check Crystal Group customer and containers
-- Run this to verify the database state

-- 1. Find Crystal Group customer
SELECT 
  c.id as customer_id,
  c.company_name,
  c.contact_person,
  c.user_id,
  c.status,
  u.phone_number,
  u.name as user_name,
  u.role
FROM customers c
JOIN users u ON u.id = c.user_id
WHERE c.company_name ILIKE '%Crystal%'
   OR u.name ILIKE '%Jawad%';

-- 2. Find containers assigned to Crystal Group
-- Replace 'CUSTOMER_ID_HERE' with the customer_id from query 1
SELECT 
  id,
  container_id as container_code,
  type,
  status,
  assigned_client_id as current_customer_id,
  current_location
FROM containers
WHERE assigned_client_id = 'bae81c00-89c0-4c6d-989f-0423c495b7b4'  -- Crystal Group customer ID
ORDER BY container_id;

-- 3. Check if containers table uses different column name
SELECT 
  id,
  container_id as container_code,
  type,
  status,
  assigned_client_id,
  current_location
FROM containers
WHERE container_id IN ('TDRU7152244', 'TRIU6617292');

-- 4. Check all columns in containers table to verify schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'containers'
ORDER BY ordinal_position;
