import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'Serivce Master.xlsx');
const outputPath = path.join(__dirname, 'service-master-headers.txt');

console.log('Checking file existence...');
if (fs.existsSync(filePath)) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const output = [];
        output.push('Headers List:');
        data[0].forEach((h, i) => output.push(`${i}: ${h}`));
        output.push('\nFirst 3 rows:');
        for (let i = 1; i <= 3; i++) {
            if (data[i]) output.push(`Row ${i}: ${JSON.stringify(data[i])}`);
        }

        fs.writeFileSync(outputPath, output.join('\n'));
        console.log('Output written to service-master-headers.txt');
    } catch (e) {
        console.error('Error reading file:', e);
    }
} else {
    console.error('File does not exist:', filePath);
}
