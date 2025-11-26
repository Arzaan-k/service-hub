# Travel Planning Test Plan

## 1. Daily Schedule Regression
1. `npm run dev` and open `http://localhost:5173/scheduling`.
2. Confirm the **Daily Schedule** tab is selected by default.
3. Verify that:
   - Summary cards (Scheduled Services, Active Technicians, etc.) render exactly as before.
   - Date picker, Auto-Assign Pending, and Send Schedules buttons work.
   - Technician schedule cards display existing data with no layout shifts.

## 2. CSS / Layout Safeguards
1. Inspect `<body>` and `#root` elements – no new styles were added to `index.css`.
2. Switch between light/dark modes (if enabled) to confirm new components inherit existing theme tokens.
3. Resize viewport (mobile, tablet, desktop) to ensure tabs, tables, and dialogs remain responsive.

## 3. Endpoint Regression & Permissions
### a. Trip CRUD Authorization
| Role | `/api/scheduling/travel/trips` (GET) | Create/Edit/Delete |
|------|--------------------------------------|--------------------|
| Admin/Coordinator/Super Admin | ✅ full access | ✅ |
| Technician | ✅ (only own trips) | ❌ (403) |
| Client/Other | ✅ (read-only) | ❌ (403) |

### b. Send Plan Route
```
curl -X POST http://localhost:5000/api/scheduling/travel/trips/<tripId>/send-plan \
  -H "x-user-id: <scheduler-user>"
```
Expect 200 with `{ message: "Travel plan sent to technician" }`. Technicians/clients receive 403.

### c. Route Conflict Check
Run `npm run dev` (frontend) and `npm run dev --workspace server` (if separate) to ensure no duplicate route warnings. `POST /api/scheduling/travel/trips/:id/send-plan` is namespaced under the travel routes so it does not collide with existing scheduling endpoints.

## 4. Frontend Feature Tests
1. **Technician Travel Tab**
   - Switch to Technician Travel tab and verify trips table renders.
   - Use Plan Technician Trip dialog to create a trip; ensure summary appears and auto-assign runs.
2. **Trip Detail Drawer**
   - Click any trip row → drawer opens with trip info, cost breakdown, and tasks list.
   - Update a task status; toast appears, list refetches.
   - Click “Send Travel Plan” → button shows loading, success toast appears.
3. **Technician View**
   - Log in as technician user → tabs render but Plan Trip button and task controls are hidden.
   - Technician only sees their own trips; direct navigation to other trip IDs returns 403.

## 5. Manual End-to-End Validation
1. Create a trip via UI, verify backend records (`SELECT * FROM technician_trips` if needed).
2. Click Auto-Assign Tasks; resulting tasks appear in drawer.
3. Click Send Travel Plan; confirm WhatsApp log (`server` console) shows message send attempt.
4. Cancel trip; status updates to `cancelled`.
5. Ensure Daily Schedule tab still functions after these actions.

Document any deviations or console errors before shipping.

