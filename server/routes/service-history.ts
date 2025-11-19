/**
 * SERVICE HISTORY API ROUTES
 * Provides endpoints for accessing historical service data
 */

import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { authenticateUser, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = Router();

// ============================================================================
// SUMMARY STATISTICS
// ============================================================================

router.get('/api/service-history/stats/summary', authenticateUser, requireRole('admin', 'coordinator', 'technician', 'client', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const userRole = (req.user?.role || 'client').toLowerCase();
    let whereClause = sql`WHERE complaint_attended_date IS NOT NULL`;

    // Client filtering - only show their own containers
    if (userRole === 'client') {
      const userName = req.user?.name || '';
      const userCompany = req.user?.company || '';
      whereClause = sql`${whereClause} AND (
        client_name ILIKE ${`%${userName}%`} OR
        (client_name ILIKE ${`%${userCompany}%`} AND ${userCompany} != '')
      )`;
    }

    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total_services,
        COUNT(DISTINCT container_number) as unique_containers,
        COUNT(DISTINCT client_name) as unique_clients,
        COUNT(DISTINCT technician_name) as unique_technicians,
        COUNT(*) FILTER (WHERE job_type = 'FOC') as foc_services,
        COUNT(*) FILTER (WHERE job_type = 'PAID' OR job_type = 'CHARGEABLE') as paid_services,
        COUNT(*) FILTER (WHERE indent_required = true) as services_with_parts,
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (complaint_attended_date - complaint_registration_time)) / 3600
          )::INTEGER,
          0
        ) as avg_response_hours
      FROM service_history
      ${whereClause}
    `);

    res.json(stats.rows[0] || {
      total_services: 0,
      unique_containers: 0,
      unique_clients: 0,
      unique_technicians: 0,
      foc_services: 0,
      paid_services: 0,
      services_with_parts: 0,
      avg_response_hours: 0
    });
  } catch (error) {
    console.error('Error fetching summary stats:', error);
    res.status(500).json({ error: 'Failed to fetch summary statistics' });
  }
});

// ============================================================================
// TOP TECHNICIANS
// ============================================================================

router.get('/api/service-history/stats/technicians', authenticateUser, requireRole('admin', 'coordinator', 'technician', 'client', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const technicians = await db.execute(sql`
      SELECT
        technician_name,
        COUNT(*) as total_jobs,
        COUNT(DISTINCT container_number) as unique_containers_serviced,
        COUNT(DISTINCT client_name) as unique_clients_served,
        MAX(complaint_attended_date) as last_service_date
      FROM service_history
      WHERE technician_name IS NOT NULL AND technician_name != ''
      GROUP BY technician_name
      ORDER BY total_jobs DESC
      LIMIT 20
    `);

    res.json(technicians.rows);
  } catch (error) {
    console.error('Error fetching technician stats:', error);
    res.status(500).json({ error: 'Failed to fetch technician statistics' });
  }
});

// ============================================================================
// CONTAINER SERVICE FREQUENCY
// ============================================================================

router.get('/api/service-history/stats/containers', authenticateUser, requireRole('admin', 'coordinator', 'technician', 'client', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const containers = await db.execute(sql`
      SELECT
        container_number,
        COUNT(*) as service_count,
        MIN(complaint_attended_date) as first_service,
        MAX(complaint_attended_date) as last_service,
        ARRAY_AGG(DISTINCT technician_name) FILTER (WHERE technician_name IS NOT NULL) as technicians_assigned,
        ARRAY_AGG(DISTINCT issues_found) FILTER (WHERE issues_found IS NOT NULL AND issues_found != '') as common_issues
      FROM service_history
      WHERE container_number IS NOT NULL
      GROUP BY container_number
      HAVING COUNT(*) >= 2
      ORDER BY service_count DESC
      LIMIT 50
    `);

    res.json(containers.rows);
  } catch (error) {
    console.error('Error fetching container stats:', error);
    res.status(500).json({ error: 'Failed to fetch container statistics' });
  }
});

// ============================================================================
// GET ALL SERVICE HISTORY (WITH PAGINATION & SEARCH)
// ============================================================================

router.get('/api/service-history', authenticateUser, requireRole('admin', 'coordinator', 'technician', 'client', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const userRole = (req.user?.role || 'client').toLowerCase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const type = req.query.type as string;

    let whereClause = sql`WHERE 1=1`;

    // Client filtering - only show their own containers
    if (userRole === 'client') {
      const userName = req.user?.name || '';
      const userCompany = req.user?.company || '';
      whereClause = sql`${whereClause} AND (
        client_name ILIKE ${`%${userName}%`} OR
        (client_name ILIKE ${`%${userCompany}%`} AND ${userCompany} != '')
      )`;
    }

    // Search filter
    if (search) {
      whereClause = sql`${whereClause} AND (
        job_order_number ILIKE ${`%${search}%`} OR
        container_number ILIKE ${`%${search}%`} OR
        client_name ILIKE ${`%${search}%`} OR
        technician_name ILIKE ${`%${search}%`}
      )`;
    }

    // Type filter
    if (type && type !== 'all') {
      if (type === 'foc') {
        whereClause = sql`${whereClause} AND job_type = 'FOC'`;
      } else if (type === 'paid') {
        whereClause = sql`${whereClause} AND (job_type = 'PAID' OR job_type = 'CHARGEABLE')`;
      } else if (type === 'preventive') {
        whereClause = sql`${whereClause} AND (
          work_type ILIKE '%PM%' OR
          work_type ILIKE '%PREVENTIVE%' OR
          work_type ILIKE '%MAINTENANCE%'
        )`;
      } else if (type === 'reactive') {
        whereClause = sql`${whereClause} AND (
          work_type NOT ILIKE '%PM%' AND
          work_type NOT ILIKE '%PREVENTIVE%'
        )`;
      }
    }

    const [history, count] = await Promise.all([
      db.execute(sql`
        SELECT *
        FROM service_history
        ${whereClause}
        ORDER BY complaint_attended_date DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*) as count
        FROM service_history
        ${whereClause}
      `)
    ]);

    let data = history.rows || [];

    // Filter sensitive data for clients
    if (userRole === 'client') {
      data = data.map((row: any) => ({
        ...row,
        technician_cost: undefined,
        technician_salary: undefined,
        internal_notes: undefined
      }));
    }

    res.json({
      data: data,
      pagination: {
        page,
        limit,
        total: parseInt(count.rows[0]?.count || '0'),
        totalPages: Math.ceil(parseInt(count.rows[0]?.count || '0') / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching service history:', error);
    res.status(500).json({ error: 'Failed to fetch service history' });
  }
});

// ============================================================================
// GET SERVICE HISTORY BY JOB ORDER NUMBER
// ============================================================================

router.get('/api/service-history/job/:jobOrderNumber', authenticateUser, requireRole('admin', 'technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const result = await db.execute(sql`
      SELECT *
      FROM service_history
      WHERE job_order_number = ${req.params.jobOrderNumber}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service history not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching service history:', error);
    res.status(500).json({ error: 'Failed to fetch service history' });
  }
});

// ============================================================================
// GET SERVICE HISTORY BY CONTAINER NUMBER
// ============================================================================

router.get('/api/service-history/container/:containerNumber', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userRole = (req.user?.role || 'client').toLowerCase();
    const containerNumber = req.params.containerNumber;

    // Check if user has permission to view this container's history
    let hasAccess = false;

    if (userRole === 'admin' || userRole === 'technician' || userRole === 'coordinator' || userRole === 'super_admin') {
      // Admin/technician/coordinator can see all containers
      hasAccess = true;
    } else if (userRole === 'client') {
      // Client can see containers - check if container exists and belongs to them
      // First check if container exists in containers table
      try {
        const containerCheck = await db.execute(sql`
          SELECT assigned_client_id as "clientId" FROM containers
          WHERE container_id = ${containerNumber} OR id::text = ${containerNumber}
          LIMIT 1
        `);

        if (containerCheck.rows.length > 0) {
          // If container has a clientId, check if it matches user
          const containerClientId = containerCheck.rows[0].clientId;
          if (containerClientId && req.user?.id && containerClientId === req.user.id) {
            hasAccess = true;
          } else {
            // Fallback: check service_history for client name match
            const serviceCheck = await db.execute(sql`
              SELECT client_name FROM service_history
              WHERE container_number = ${containerNumber}
              LIMIT 1
            `);

            if (serviceCheck.rows.length > 0) {
              const clientName = serviceCheck.rows[0].client_name;
              hasAccess = clientName && (
                clientName.toLowerCase().includes((req.user?.name || '').toLowerCase()) ||
                (req.user?.company && clientName.toLowerCase().includes(req.user.company.toLowerCase()))
              );
            } else {
              // If no service history exists, allow access for now (they can see empty state)
              hasAccess = true;
            }
          }
        } else {
          // Container doesn't exist in containers table, check service_history
          const serviceCheck = await db.execute(sql`
            SELECT client_name FROM service_history
            WHERE container_number = ${containerNumber}
            LIMIT 1
          `);

          if (serviceCheck.rows.length > 0) {
            const clientName = serviceCheck.rows[0].client_name;
            hasAccess = clientName && (
              clientName.toLowerCase().includes((req.user?.name || '').toLowerCase()) ||
              (req.user?.company && clientName.toLowerCase().includes(req.user.company.toLowerCase()))
            );
          } else {
            // No data found, allow access to see empty state
            hasAccess = true;
          }
        }
      } catch (err) {
        // If containers table doesn't exist or query fails, allow access
        console.log('Container check failed, allowing access:', err);
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this container history' });
    }

    // Try to match container number flexibly - could be container code or ID
    let history;
    try {
      // First try exact match
      history = await db.execute(sql`
        SELECT *
        FROM service_history
        WHERE container_number = ${containerNumber}
        ORDER BY complaint_attended_date DESC
      `);

      // If no results, try case-insensitive match
      if (history.rows.length === 0) {
        history = await db.execute(sql`
          SELECT *
          FROM service_history
          WHERE UPPER(container_number) = UPPER(${containerNumber})
          ORDER BY complaint_attended_date DESC
        `);
      }

      // If still no results, try partial match
      if (history.rows.length === 0) {
        history = await db.execute(sql`
          SELECT *
          FROM service_history
          WHERE container_number ILIKE ${`%${containerNumber}%`}
          ORDER BY complaint_attended_date DESC
        `);
      }
    } catch (err) {
      console.error('Error querying service_history:', err);
      history = { rows: [] };
    }

    let data = history.rows || [];

    // Filter sensitive data for clients
    if (userRole === 'client') {
      data = data.map((row: any) => ({
        ...row,
        // Remove sensitive fields for clients
        technician_cost: undefined,
        technician_salary: undefined,
        internal_notes: undefined,
        // Only show basic service information
        id: row.id,
        job_order_number: row.job_order_number,
        complaint_attended_date: row.complaint_attended_date,
        container_number: row.container_number,
        client_name: row.client_name,
        work_type: row.work_type,
        job_type: row.job_type,
        issues_found: row.issues_found,
        work_description: row.work_description,
        complaint_registration_time: row.complaint_registration_time
      }));
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching container history:', error);
    res.status(500).json({ error: 'Failed to fetch container history' });
  }
});

// ============================================================================
// GET SERVICE HISTORY BY CLIENT NAME
// ============================================================================

router.get('/api/service-history/client/:clientName', authenticateUser, requireRole('admin', 'technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const history = await db.execute(sql`
      SELECT *
      FROM service_history
      WHERE client_name ILIKE ${`%${req.params.clientName}%`}
      ORDER BY complaint_attended_date DESC
    `);

    res.json(history.rows);
  } catch (error) {
    console.error('Error fetching client history:', error);
    res.status(500).json({ error: 'Failed to fetch client history' });
  }
});

// ============================================================================
// GET SERVICE HISTORY BY TECHNICIAN
// ============================================================================

router.get('/api/service-history/technician/:technicianName', authenticateUser, requireRole('admin', 'technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const history = await db.execute(sql`
      SELECT *
      FROM service_history
      WHERE technician_name ILIKE ${`%${req.params.technicianName}%`}
      ORDER BY complaint_attended_date DESC
    `);

    res.json(history.rows);
  } catch (error) {
    console.error('Error fetching technician history:', error);
    res.status(500).json({ error: 'Failed to fetch technician history' });
  }
});

// ============================================================================
// GET COMMON ISSUES ANALYTICS
// ============================================================================

router.get('/api/service-history/analytics/issues', authenticateUser, requireRole('admin', 'technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const issues = await db.execute(sql`
      SELECT
        issues_found,
        COUNT(*) as occurrence_count,
        ARRAY_AGG(DISTINCT container_number) as affected_containers,
        ARRAY_AGG(DISTINCT technician_name) FILTER (WHERE technician_name IS NOT NULL) as handled_by
      FROM service_history
      WHERE issues_found IS NOT NULL AND issues_found != ''
      GROUP BY issues_found
      ORDER BY occurrence_count DESC
      LIMIT 20
    `);

    res.json(issues.rows);
  } catch (error) {
    console.error('Error fetching issue analytics:', error);
    res.status(500).json({ error: 'Failed to fetch issue analytics' });
  }
});

// ============================================================================
// GET SERVICE TIMELINE FOR CONTAINER
// ============================================================================

router.get('/api/service-history/container/:containerNumber/timeline', authenticateUser, async (req: AuthRequest, res) => {
  try {
    const userRole = (req.user?.role || 'client').toLowerCase();
    const containerNumber = req.params.containerNumber;

    // Check if user has permission to view this container's timeline
    let hasAccess = false;

    if (userRole === 'admin' || userRole === 'technician' || userRole === 'super_admin') {
      hasAccess = true;
    } else if (userRole === 'client') {
      const containerCheck = await db.execute(sql`
        SELECT client_name FROM service_history
        WHERE container_number = ${containerNumber}
        LIMIT 1
      `);

      if (containerCheck.rows.length > 0) {
        const clientName = containerCheck.rows[0].client_name;
        hasAccess = clientName && (
          clientName.toLowerCase().includes((req.user?.name || '').toLowerCase()) ||
          (req.user?.company && clientName.toLowerCase().includes(req.user.company.toLowerCase()))
        );
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this container timeline' });
    }

    const timeline = await db.execute(sql`
      SELECT
        job_order_number,
        complaint_attended_date,
        work_type,
        job_type,
        technician_name,
        issues_found,
        work_description,
        required_spare_parts
      FROM service_history
      WHERE container_number = ${req.params.containerNumber}
      ORDER BY complaint_attended_date ASC
    `);

    let data = timeline.rows;

    // Filter sensitive data for clients
    if (userRole === 'client') {
      data = data.map(row => ({
        ...row,
        // Remove sensitive fields for clients
        technician_name: undefined,
        required_spare_parts: undefined
      }));
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching container timeline:', error);
    res.status(500).json({ error: 'Failed to fetch container timeline' });
  }
});

// ============================================================================
// EXPORT SERVICE HISTORY (CSV)
// ============================================================================

router.get('/api/service-history/export/csv', authenticateUser, requireRole('admin', 'technician', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const { containerNumber, startDate, endDate } = req.query;

    let whereClause = sql`WHERE 1=1`;

    if (containerNumber) {
      whereClause = sql`${whereClause} AND container_number = ${containerNumber as string}`;
    }

    if (startDate) {
      whereClause = sql`${whereClause} AND complaint_attended_date >= ${startDate as string}`;
    }

    if (endDate) {
      whereClause = sql`${whereClause} AND complaint_attended_date <= ${endDate as string}`;
    }

    const data = await db.execute(sql`
      SELECT
        job_order_number,
        complaint_attended_date,
        container_number,
        client_name,
        technician_name,
        work_type,
        job_type,
        issues_found,
        work_description,
        required_spare_parts
      FROM service_history
      ${whereClause}
      ORDER BY complaint_attended_date DESC
    `);

    // Convert to CSV
    const headers = [
      'Job Order',
      'Service Date',
      'Container',
      'Client',
      'Technician',
      'Work Type',
      'Job Type',
      'Issues',
      'Work Done',
      'Parts Used'
    ];

    const csvRows = [headers.join(',')];

    data.rows.forEach((row: any) => {
      const values = [
        row.job_order_number,
        row.complaint_attended_date,
        row.container_number,
        row.client_name,
        row.technician_name || '',
        row.work_type || '',
        row.job_type || '',
        (row.issues_found || '').replace(/,/g, ';'),
        (row.work_description || '').replace(/,/g, ';'),
        (row.required_spare_parts || '').replace(/,/g, ';')
      ];
      csvRows.push(values.join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=service-history.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting service history:', error);
    res.status(500).json({ error: 'Failed to export service history' });
  }
});

// ============================================================================
// CLIENT SERVICE HISTORY (LIMITED ACCESS)
// ============================================================================

router.get('/api/service-history/my-containers', authenticateUser, requireRole('client'), async (req: AuthRequest, res) => {
  try {
    // Get containers that belong to this client
    // This is a simplified approach - in production, there should be a proper
    // client-container relationship table
    const userName = req.user?.name || '';
    const userCompany = req.user?.company || '';

    const containers = await db.execute(sql`
      SELECT DISTINCT
        container_number,
        client_name,
        MAX(complaint_attended_date) as last_service_date,
        COUNT(*) as total_services
      FROM service_history
      WHERE client_name ILIKE ${`%${userName}%`}
         OR (client_name ILIKE ${`%${userCompany}%`} AND ${userCompany} != '')
      GROUP BY container_number, client_name
      ORDER BY last_service_date DESC
    `);

    res.json(containers.rows);
  } catch (error) {
    console.error('Error fetching client containers:', error);
    res.status(500).json({ error: 'Failed to fetch your containers' });
  }
});

export default router;
