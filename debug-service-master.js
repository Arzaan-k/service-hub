import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'Serivce Master.xlsx');

console.log('Checking file existence...');
if (fs.existsSync(filePath)) {
    console.log('File exists.');
    try {
        console.log('Reading file...');
        // Try different ways to access readFile if needed, but default export usually works
        const workbook = XLSX.readFile(filePath);
        console.log('File read successfully.');
        const sheetName = workbook.SheetNames[0];
        console.log(`Sheet Name: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log('Headers List:');
        data[0].forEach((h, i) => console.log(`${i}: ${h}`));
        // Print first 3 rows
        for (let i = 1; i <= 3; i++) {
            if (data[i]) console.log(`Row ${i}:`, JSON.stringify(data[i]));
        }
    } catch (e) {
        console.error('Error reading file:', e);
    }
} else {
    console.error('File does not exist:', filePath);
}
