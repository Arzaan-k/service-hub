import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'Serivce Master.xlsx');

try {
    console.log(`Reading file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    console.log(`Sheet Name: ${sheetName}`);

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length === 0) {
        console.log('Sheet is empty');
    } else {
        console.log('Headers:', data[0]);
        console.log('First 3 rows:');
        data.slice(1, 4).forEach((row, index) => {
            console.log(`Row ${index + 1}:`, row);
        });
    }
} catch (error) {
    console.error('Error reading file:', error);
}
