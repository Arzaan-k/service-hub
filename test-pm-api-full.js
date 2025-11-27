import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function test() {
  try {
    console.log('[API] PM Overview requested');

    // First get all PM records from service_history
    const pmRecords = await db.execute(sql`
      SELECT 
        UPPER(TRIM(container_number)) as container_number,
        MAX(complaint_attended_date) as last_pm_date,
        COUNT(*) as pm_count
      FROM service_history
      WHERE UPPER(work_type) LIKE '%PREVENTIVE%'
        AND container_number IS NOT NULL
        AND container_number != ''
      GROUP BY UPPER(TRIM(container_number))
    `);
    
    console.log('[API] Found PM records for', pmRecords.rows.length, 'containers');
    
    // Create a map of container -> PM data
    const pmMap = new Map();
    for (const row of pmRecords.rows) {
      pmMap.set(row.container_number, {
        last_pm_date: row.last_pm_date,
        pm_count: parseInt(row.pm_count) || 0
      });
    }

    // Get all active containers
    const containers = await db.execute(sql`
      SELECT 
        c.id,
        c.container_id,
        c.status,
        c.depot,
        c.grade,
        cust.company_name as customer_name
      FROM containers c
      LEFT JOIN customers cust ON c.assigned_client_id = cust.id
      WHERE c.status = 'active'
      ORDER BY c.container_id
      LIMIT 100
    `);
    
    console.log('[API] Found', containers.rows.length, 'active containers');

    // Merge container data with PM data
    const now = new Date();
    const result = containers.rows.map(container => {
      const containerIdUpper = (container.container_id || '').toUpperCase().trim();
      const pmData = pmMap.get(containerIdUpper);
      
      let daysSincePm = null;
      let pmStatus = 'NEVER';
      
      if (pmData && pmData.last_pm_date) {
        const lastPmDate = new Date(pmData.last_pm_date);
        daysSincePm = Math.floor((now.getTime() - lastPmDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSincePm > 90) {
          pmStatus = 'OVERDUE';
        } else if (daysSincePm > 75) {
          pmStatus = 'DUE_SOON';
        } else {
          pmStatus = 'UP_TO_DATE';
        }
      }
      
      return {
        id: container.id,
        container_id: container.container_id,
        status: container.status,
        depot: container.depot,
        grade: container.grade,
        customer_name: container.customer_name,
        last_pm_date: pmData?.last_pm_date || null,
        pm_count: pmData?.pm_count || 0,
        days_since_pm: daysSincePm,
        pm_status: pmStatus
      };
    });

    // Sort by PM status priority
    result.sort((a, b) => {
      const priority = { 'NEVER': 1, 'OVERDUE': 2, 'DUE_SOON': 3, 'UP_TO_DATE': 4 };
      const aPriority = priority[a.pm_status] || 5;
      const bPriority = priority[b.pm_status] || 5;
      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.days_since_pm === null) return -1;
      if (b.days_since_pm === null) return 1;
      return b.days_since_pm - a.days_since_pm;
    });

    // Get summary counts
    const summary = {
      total: result.length,
      never: result.filter(r => r.pm_status === 'NEVER').length,
      overdue: result.filter(r => r.pm_status === 'OVERDUE').length,
      dueSoon: result.filter(r => r.pm_status === 'DUE_SOON').length,
      upToDate: result.filter(r => r.pm_status === 'UP_TO_DATE').length,
    };

    console.log('[API] PM Overview summary:', summary);
    console.log('\nSample containers:');
    result.slice(0, 5).forEach(c => {
      console.log(`  ${c.container_id}: ${c.pm_status} - Last PM: ${c.last_pm_date || 'Never'} - Days: ${c.days_since_pm || 'N/A'}`);
    });

    const response = {
      success: true,
      summary,
      containers: result,
    };
    
    console.log('\nResponse structure:', {
      success: response.success,
      summaryKeys: Object.keys(response.summary),
      containersCount: response.containers.length
    });

  } catch (error) {
    console.error('[API] PM Overview error:', error);
  }
  
  process.exit(0);
}

test();

