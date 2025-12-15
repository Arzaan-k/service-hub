import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createTrainingTables() {
  console.log("🚀 Creating training module tables...");

  try {
    // Create training_materials table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS training_materials (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        
        -- File information
        file_type VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_data BYTEA NOT NULL,
        file_size BIGINT NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        
        -- Role assignment
        for_client BOOLEAN DEFAULT false,
        for_technician BOOLEAN DEFAULT false,
        
        -- Metadata
        uploaded_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_training_uploaded_by 
          FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
        
        CONSTRAINT check_at_least_one_role 
          CHECK (for_client = true OR for_technician = true)
      )
    `);
    console.log("✅ training_materials table created");

    // Create training_views table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS training_views (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        material_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        user_role VARCHAR(50) NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_training_views_material 
          FOREIGN KEY (material_id) REFERENCES training_materials(id) ON DELETE CASCADE,
        
        CONSTRAINT unique_user_material_view 
          UNIQUE (material_id, user_id)
      )
    `);
    console.log("✅ training_views table created");

    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_training_materials_for_client 
        ON training_materials(for_client)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_training_materials_for_technician 
        ON training_materials(for_technician)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_training_materials_category 
        ON training_materials(category)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_training_materials_created_at 
        ON training_materials(created_at DESC)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_training_views_user 
        ON training_views(user_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_training_views_material 
        ON training_views(material_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_training_views_user_role 
        ON training_views(user_id, user_role)
    `);

    console.log("✅ All indexes created");
    console.log("🎉 Training module tables created successfully!");

  } catch (error) {
    console.error("❌ Error creating training tables:", error);
    throw error;
  }
}

createTrainingTables()
  .then(() => {
    console.log("✅ Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
