import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('Checking container counts...\n');

const totalResult = await sql`SELECT COUNT(*) as count FROM containers`;
console.log('Total containers in database:', totalResult[0].count);

const withMasterResult = await sql`
  SELECT COUNT(*) as count
  FROM containers
  WHERE product_type IS NOT NULL
     OR depot IS NOT NULL
     OR grade IS NOT NULL
     OR yom IS NOT NULL
`;
console.log('Containers with master sheet data:', withMasterResult[0].count);

const productTypes = await sql`
  SELECT product_type, COUNT(*) as count
  FROM containers
  WHERE product_type IS NOT NULL
  GROUP BY product_type
  ORDER BY count DESC
`;
console.log('\nProduct type breakdown:');
productTypes.forEach(row => {
  console.log(`  ${row.product_type}: ${row.count}`);
});

const grades = await sql`
  SELECT grade, COUNT(*) as count
  FROM containers
  WHERE grade IS NOT NULL
  GROUP BY grade
  ORDER BY count DESC
`;
console.log('\nGrade breakdown:');
grades.forEach(row => {
  console.log(`  Grade ${row.grade}: ${row.count}`);
});

process.exit(0);
