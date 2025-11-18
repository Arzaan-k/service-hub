import 'dotenv/config';
import XLSX from 'xlsx';
import { storage } from '../storage';
import { db } from '../db';

type RentalRow = Record<string, any>;

function normalizeHeader(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function pick<T = any>(row: RentalRow, keys: string[]): T | undefined {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v as T;
  }
  return undefined;
}

function parseDate(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const num = Number(value);
  if (!Number.isNaN(num) && num > 25569) {
    // Excel serial date
    const ms = (num - 25569) * 86400 * 1000;
    return new Date(ms);
  }
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? undefined : d;
}

async function main() {
  const filePath = process.env.RENTAL_XLSX_PATH || 'Rental List.xlsx';
  console.log(`📄 Importing rentals from: ${filePath}`);

  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rowsRaw: RentalRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  if (rowsRaw.length === 0) {
    console.log('⚠️ No rows found in the rental sheet.');
    return;
  }

  // Normalize headers for robust mapping
  const headers = Object.keys(rowsRaw[0]);
  const headerMap = new Map<string, string>();
  for (const h of headers) headerMap.set(normalizeHeader(h), h);

  function get(row: RentalRow, logical: string, fallbacks: string[] = []): any {
    const keys = [logical, ...fallbacks].map(normalizeHeader);
    for (const k of keys) {
      const actual = headerMap.get(k);
      if (actual && row[actual] !== undefined) return row[actual];
    }
    return undefined;
  }

  let processed = 0;
  let createdCustomers = 0;
  let assigned = 0;
  let missingContainers: string[] = [];

  // Preload customers to reduce DB lookups and enable idempotency
  const existingCustomers = await storage.getAllCustomers();
  const emailSet = new Set(existingCustomers.map((c: any) => (c.email || '').toLowerCase()));
  const phoneSet = new Set(existingCustomers.map((c: any) => c.phone || ''));
  const companyMap = new Map<string, any>();
  for (const c of existingCustomers) {
    const key = (c.companyName || '').toLowerCase().trim();
    if (key && !companyMap.has(key)) companyMap.set(key, c);
  }

  function makeUniqueEmail(base: string): string {
    let candidate = base.toLowerCase();
    if (!emailSet.has(candidate)) {
      emailSet.add(candidate);
      return candidate;
    }
    const [local, domain] = candidate.split('@');
    let i = 2;
    while (emailSet.has(`${local}+${i}@${domain}`)) i++;
    const unique = `${local}+${i}@${domain}`;
    emailSet.add(unique);
    return unique;
  }

  function makeSyntheticEmail(companyOrContainer: string): string {
    const slug = companyOrContainer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'autogen';
    return makeUniqueEmail(`${slug}@autogen.local`);
  }

  function makeUniquePhone(preferred?: string): string {
    let candidate = preferred && preferred.trim();
    if (candidate && !phoneSet.has(candidate)) {
      phoneSet.add(candidate);
      return candidate;
    }
    // Generate synthetic unique phone
    let unique: string;
    do {
      unique = `+000${Math.floor(Math.random() * 1e12).toString().padStart(12, '0')}`;
    } while (phoneSet.has(unique));
    phoneSet.add(unique);
    return unique;
  }

  for (const row of rowsRaw) {
    // Column guesses
    const containerCode = String(
      get(row, 'container_id', ['container', 'container_code', 'serial', 'unit', 'unit_no', 'container__no']) ||
      get(row, 'container_no', ['container__no', 'container__  no', 'container__  no']) ||
      get(row, 'container__no') ||
      get(row, 'container__  no') ||
      ''
    ).replace(/\s+/g, '').trim();
    if (!containerCode) continue;

    const companyName = String(
      get(row, 'customer', ['client', 'company', 'customer_name', 'client_name', 'customer_name']) ||
      get(row, 'customer__name') || ''
    ).trim();
    const contactPerson = String(get(row, 'contact_person', ['contact', 'contact_name']) || companyName).trim();
    const phone = String(get(row, 'phone', ['contact_no', 'mobile', 'whatsapp', 'phone_number']) || '').trim();
    const email = String(get(row, 'email', ['mail', 'email_id']) || `${containerCode.toLowerCase()}@autogen.local`).trim();
    const billingAddress = String(get(row, 'address', ['billing_address']) || get(row, 'location') || '').trim();
    const whatsappNumber = String(get(row, 'whatsapp', ['whatsapp_number', 'wa']) || phone || '').trim();

    const assignmentDate = parseDate(get(row, 'assignment_date', ['start_date', 'rental_start', 'from', 'deployed__date']));
    const expectedReturnDate = parseDate(get(row, 'expected_return_date', ['end_date', 'rental_end', 'to']));

    // Find container
    let container = await storage.getContainerByContainerId(containerCode);
    if (!container) {
      // Auto-create missing containers per PRD registry requirement
      const size = String(get(row, 'size') || '').trim();
      const type = String(get(row, 'type') || '').trim().toLowerCase();
      const loc = String(get(row, 'location') || '').trim();
      const city = String(get(row, 'city') || '').trim();
      const state = String(get(row, 'state') || '').trim();

      const created = await storage.createContainer({
        containerCode: containerCode,
        type: ['refrigerated','dry','special'].includes(type) ? type : 'dry',
        capacity: size || 'Standard',
        status: 'active',
        hasIot: false,
        currentLocation: null,
        excelMetadata: {
          rentalRow: row,
          importedAt: new Date().toISOString(),
          source: 'Rental List.xlsx',
          textualLocation: { location: loc, city, state }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      container = created;
    }

    // Upsert minimal user+customer: use phone as primary identity; fall back to email
    // For simplicity here, create a synthetic user if not present via phone.
    let customer = undefined as any;
    // Try to map an existing customer by company or phone
    const companyKey = companyName.toLowerCase().trim();
    if (companyKey && companyMap.has(companyKey)) {
      customer = companyMap.get(companyKey);
    } else if (phone && phoneSet.has(phone)) {
      customer = existingCustomers.find((c: any) => c.phone === phone);
      if (customer && companyKey && !companyMap.has(companyKey)) companyMap.set(companyKey, customer);
    }

    if (!customer) {
      // Create a lightweight user first
      const uniquePhone = makeUniquePhone(phone);
      const uniqueEmail = email ? makeUniqueEmail(email) : makeSyntheticEmail(companyName || containerCode);

      const user = await storage.createUser({
        phoneNumber: uniquePhone,
        name: contactPerson || companyName || 'Auto Customer',
        email: uniqueEmail,
        role: 'client',
        isActive: true,
        whatsappVerified: false,
      } as any);

      customer = await storage.createCustomer({
        userId: user.id,
        companyName: companyName || contactPerson || 'Unknown Company',
        contactPerson: contactPerson || companyName || 'Unknown',
        email: user.email,
        phone: user.phoneNumber,
        whatsappNumber: makeUniquePhone(whatsappNumber || user.phoneNumber),
        customerTier: 'standard',
        paymentTerms: 'net30',
        billingAddress: billingAddress || 'N/A',
        shippingAddress: billingAddress || null,
        status: 'active',
      } as any);
      createdCustomers++;
      if (companyKey) companyMap.set(companyKey, customer);
    }

    // Assign container and persist excel metadata
    const updated = await storage.updateContainer(container.id, {
      currentCustomerId: customer.id,
      assignmentDate: assignmentDate || container.assignmentDate || new Date(),
      expectedReturnDate: expectedReturnDate || container.expectedReturnDate || null,
      excelMetadata: {
        ...(container.excelMetadata || {}),
        rentalRow: row,
        importedAt: new Date().toISOString(),
        source: 'Rental List.xlsx',
      },
    });

    if (updated) assigned++;
    processed++;
  }

  console.log('✅ Rental import completed');
  console.log(`Processed rows: ${processed}`);
  console.log(`Customers created: ${createdCustomers}`);
  console.log(`Containers assigned: ${assigned}`);
  if (missingContainers.length) {
    console.log('⚠️ Containers not found in DB (check container_id values):');
    console.log([...new Set(missingContainers)].slice(0, 50).join(', '));
    if (missingContainers.length > 50) {
      console.log(`... and ${missingContainers.length - 50} more`);
    }
  }
}

main().catch((err) => {
  console.error('❌ Rental import failed:', err);
  process.exit(1);
});


