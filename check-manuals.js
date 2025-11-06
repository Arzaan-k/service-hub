import 'dotenv/config';
import { db } from './server/db.js';
import { manuals } from './shared/schema.js';
import * as fs from 'fs';
import * as path from 'path';

async function checkManuals() {
  const allManuals = await db.select().from(manuals);
  const uploadDir = path.join(process.cwd(), 'uploads', 'manuals');

  console.log('📚 MANUALS STATUS:');
  console.log(`Total manuals: ${allManuals.length}`);

  let valid = 0;
  let invalid = 0;

  allManuals.forEach((manual, i) => {
    const sourceUrl = manual.sourceUrl;
    if (!sourceUrl) {
      console.log(`${i + 1}. ❌ No source URL: ${manual.name.substring(0, 40)}...`);
      invalid++;
      return;
    }

    const filePath = path.isAbsolute(sourceUrl) ? sourceUrl : path.join(uploadDir, sourceUrl);
    if (!fs.existsSync(filePath)) {
      console.log(`${i + 1}. ❌ File not found: ${manual.name.substring(0, 40)}...`);
      invalid++;
      return;
    }

    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`${i + 1}. ✅ ${manual.name.substring(0, 40)}... (${sizeMB} MB)`);
    valid++;
  });

  console.log(`\n📊 SUMMARY:`);
  console.log(`Valid manuals: ${valid}`);
  console.log(`Invalid manuals: ${invalid}`);
}

checkManuals().catch(console.error);




