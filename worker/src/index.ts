import { getCorsHeaders, isAuthorized } from './auth';
import { Env, SyncPayload, D1PreparedStatement } from './types';
import { ensureDatabaseSchema } from './schema';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 1. Health check endpoint
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'qiyue-ledger-d1-api',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Authentication check
    if (!isAuthorized(request, env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: 无效的 API Token 访问凭证，请检查 Worker Secret 设置',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      // 3. POST /api/init - 一键初始化 / 自愈 D1 数据库所有数据表与索引
      if (url.pathname === '/api/init' && (request.method === 'POST' || request.method === 'GET')) {
        await ensureDatabaseSchema(env);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Cloudflare D1 数据库表结构与元数据已成功初始化！',
            timestamp: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. GET /api/sync - 从 D1 拉取全量/增量云端数据
      if (request.method === 'GET' && url.pathname === '/api/sync') {
        const includeDeleted = url.searchParams.get('include_deleted') === 'true';
        const deletedFilter = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

        const runFetch = async () => {
          return await Promise.all([
            env.DB.prepare(`SELECT * FROM salaries ${deletedFilter} ORDER BY month DESC`).all(),
            env.DB.prepare(`SELECT * FROM overtimes ${deletedFilter} ORDER BY date DESC`).all(),
            env.DB.prepare(`SELECT * FROM social_gifts ${deletedFilter} ORDER BY date DESC`).all(),
            env.DB.prepare(`SELECT * FROM vehicles ${deletedFilter}`).all(),
            env.DB.prepare(`SELECT * FROM fuel_records ${deletedFilter} ORDER BY date DESC`).all(),
            env.DB.prepare(`SELECT * FROM maintenance_records ${deletedFilter} ORDER BY date DESC`).all(),
            env.DB.prepare('SELECT * FROM app_settings').all(),
            env.DB.prepare("SELECT * FROM sync_meta WHERE key = 'global'").first(),
          ]);
        };

        let results;
        try {
          results = await runFetch();
        } catch (queryErr: any) {
          // 如果出现表不存在 (no such table)，自动自愈创建表并重试
          if (queryErr.message && queryErr.message.includes('no such table')) {
            await ensureDatabaseSchema(env);
            results = await runFetch();
          } else {
            throw queryErr;
          }
        }

        const [
          salariesRes,
          overtimesRes,
          giftsRes,
          vehiclesRes,
          fuelsRes,
          maintenancesRes,
          settingsRes,
          syncMetaRes,
        ] = results;

        return new Response(
          JSON.stringify({
            success: true,
            version: 2,
            timestamp: new Date().toISOString(),
            data: {
              salaries: salariesRes.results || [],
              overtimes: overtimesRes.results || [],
              gifts: giftsRes.results || [],
              vehicles: vehiclesRes.results || [],
              fuels: fuelsRes.results || [],
              maintenances: maintenancesRes.results || [],
              settings: settingsRes.results || [],
              syncMeta: syncMetaRes || { key: 'global', revision: 1, schema_version: 2 },
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 5. POST /api/sync - 将客户端数据同步推送到 D1
      if (request.method === 'POST' && url.pathname === '/api/sync') {
        const payload: SyncPayload = await request.json();
        const nowIso = new Date().toISOString();

        const buildStatements = (): D1PreparedStatement[] => {
          const statements: D1PreparedStatement[] = [];

          // 1. Salaries
          if (Array.isArray(payload.salaries)) {
            for (const s of payload.salaries) {
              statements.push(
                env.DB.prepare(
                  `INSERT INTO salaries (
                    id, month, company_name, base_salary, performance_pay, overtime_pay, allowance, other_bonus,
                    pre_tax_deduction, gross_salary, pension_personal, medical_personal, unemployment_personal,
                    housing_fund_personal, total_personal_insurance, pension_company, medical_company, unemployment_company,
                    injury_company, maternity_company, housing_fund_company, total_company_insurance, special_deductions,
                    tax_threshold, taxable_income, individual_income_tax, net_salary, company_total_cost, pay_date, notes,
                    created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    month = excluded.month,
                    company_name = excluded.company_name,
                    base_salary = excluded.base_salary,
                    performance_pay = excluded.performance_pay,
                    overtime_pay = excluded.overtime_pay,
                    allowance = excluded.allowance,
                    other_bonus = excluded.other_bonus,
                    pre_tax_deduction = excluded.pre_tax_deduction,
                    gross_salary = excluded.gross_salary,
                    pension_personal = excluded.pension_personal,
                    medical_personal = excluded.medical_personal,
                    unemployment_personal = excluded.unemployment_personal,
                    housing_fund_personal = excluded.housing_fund_personal,
                    total_personal_insurance = excluded.total_personal_insurance,
                    pension_company = excluded.pension_company,
                    medical_company = excluded.medical_company,
                    unemployment_company = excluded.unemployment_company,
                    injury_company = excluded.injury_company,
                    maternity_company = excluded.maternity_company,
                    housing_fund_company = excluded.housing_fund_company,
                    total_company_insurance = excluded.total_company_insurance,
                    special_deductions = excluded.special_deductions,
                    tax_threshold = excluded.tax_threshold,
                    taxable_income = excluded.taxable_income,
                    individual_income_tax = excluded.individual_income_tax,
                    net_salary = excluded.net_salary,
                    company_total_cost = excluded.company_total_cost,
                    pay_date = excluded.pay_date,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at`
                ).bind(
                  s.id,
                  s.month,
                  s.companyName || s.company_name || '',
                  s.baseSalary ?? s.base_salary ?? 0,
                  s.performancePay ?? s.performance_pay ?? 0,
                  s.overtimePay ?? s.overtime_pay ?? 0,
                  s.allowance ?? 0,
                  s.otherBonus ?? s.other_bonus ?? 0,
                  s.preTaxDeduction ?? s.pre_tax_deduction ?? 0,
                  s.grossSalary ?? s.gross_salary ?? 0,
                  s.pensionPersonal ?? s.pension_personal ?? 0,
                  s.medicalPersonal ?? s.medical_personal ?? 0,
                  s.unemploymentPersonal ?? s.unemployment_personal ?? 0,
                  s.housingFundPersonal ?? s.housing_fund_personal ?? 0,
                  s.totalPersonalInsurance ?? s.total_personal_insurance ?? 0,
                  s.pensionCompany ?? s.pension_company ?? 0,
                  s.medicalCompany ?? s.medical_company ?? 0,
                  s.unemploymentCompany ?? s.unemployment_company ?? 0,
                  s.injuryCompany ?? s.injury_company ?? 0,
                  s.maternityCompany ?? s.maternity_company ?? 0,
                  s.housingFundCompany ?? s.housing_fund_company ?? 0,
                  s.totalCompanyInsurance ?? s.total_company_insurance ?? 0,
                  s.specialDeductions ?? s.special_deductions ?? 0,
                  s.taxThreshold ?? s.tax_threshold ?? 5000,
                  s.taxableIncome ?? s.taxable_income ?? 0,
                  s.individualIncomeTax ?? s.individual_income_tax ?? 0,
                  s.netSalary ?? s.net_salary ?? 0,
                  s.companyTotalCost ?? s.company_total_cost ?? 0,
                  s.payDate || s.pay_date || '',
                  s.notes || '',
                  s.createdAt || s.created_at || nowIso,
                  s.updatedAt || s.updated_at || nowIso,
                  s.deletedAt || s.deleted_at || null
                )
              );
            }
          }

          // 2. Overtimes
          if (Array.isArray(payload.overtimes)) {
            for (const o of payload.overtimes) {
              statements.push(
                env.DB.prepare(
                  `INSERT INTO overtimes (
                    id, date, type, start_time, end_time, duration_hours, multiplier,
                    settlement_type, hourly_rate, estimated_pay, comp_time_hours_used,
                    reason, approver, notes, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    date = excluded.date,
                    type = excluded.type,
                    start_time = excluded.start_time,
                    end_time = excluded.end_time,
                    duration_hours = excluded.duration_hours,
                    multiplier = excluded.multiplier,
                    settlement_type = excluded.settlement_type,
                    hourly_rate = excluded.hourly_rate,
                    estimated_pay = excluded.estimated_pay,
                    comp_time_hours_used = excluded.comp_time_hours_used,
                    reason = excluded.reason,
                    approver = excluded.approver,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at`
                ).bind(
                  o.id,
                  o.date,
                  o.type,
                  o.startTime || o.start_time || '',
                  o.endTime || o.end_time || '',
                  o.durationHours ?? o.duration_hours ?? 0,
                  o.multiplier ?? 1.5,
                  o.settlementType || o.settlement_type || 'paid',
                  o.hourlyRate ?? o.hourly_rate ?? 0,
                  o.estimatedPay ?? o.estimated_pay ?? 0,
                  o.compTimeHoursUsed ?? o.comp_time_hours_used ?? 0,
                  o.reason || '',
                  o.approver || '',
                  o.notes || '',
                  o.createdAt || o.created_at || nowIso,
                  o.updatedAt || o.updated_at || nowIso,
                  o.deletedAt || o.deleted_at || null
                )
              );
            }
          }

          // 3. Social Gifts
          if (Array.isArray(payload.gifts)) {
            for (const g of payload.gifts) {
              statements.push(
                env.DB.prepare(
                  `INSERT INTO social_gifts (
                    id, date, direction, person_name, relation, event_type, amount,
                    return_status, return_amount, location, notes, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    date = excluded.date,
                    direction = excluded.direction,
                    person_name = excluded.person_name,
                    relation = excluded.relation,
                    event_type = excluded.event_type,
                    amount = excluded.amount,
                    return_status = excluded.return_status,
                    return_amount = excluded.return_amount,
                    location = excluded.location,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at`
                ).bind(
                  g.id,
                  g.date,
                  g.direction,
                  g.personName || g.person_name || '',
                  g.relation,
                  g.eventType || g.event_type,
                  g.amount ?? 0,
                  g.returnStatus || g.return_status || 'none_needed',
                  g.returnAmount ?? g.return_amount ?? 0,
                  g.location || '',
                  g.notes || '',
                  g.createdAt || g.created_at || nowIso,
                  g.updatedAt || g.updated_at || nowIso,
                  g.deletedAt || g.deleted_at || null
                )
              );
            }
          }

          // 4. Vehicles
          if (Array.isArray(payload.vehicles)) {
            for (const v of payload.vehicles) {
              statements.push(
                env.DB.prepare(
                  `INSERT INTO vehicles (
                    id, name, plate_number, fuel_type, tank_capacity, initial_odometer,
                    current_odometer, maintenance_interval_km, maintenance_interval_days,
                    last_maintenance_date, last_maintenance_odometer, insurance_expiry_date,
                    annual_inspection_date, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    plate_number = excluded.plate_number,
                    fuel_type = excluded.fuel_type,
                    tank_capacity = excluded.tank_capacity,
                    initial_odometer = excluded.initial_odometer,
                    current_odometer = excluded.current_odometer,
                    maintenance_interval_km = excluded.maintenance_interval_km,
                    maintenance_interval_days = excluded.maintenance_interval_days,
                    last_maintenance_date = excluded.last_maintenance_date,
                    last_maintenance_odometer = excluded.last_maintenance_odometer,
                    insurance_expiry_date = excluded.insurance_expiry_date,
                    annual_inspection_date = excluded.annual_inspection_date,
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at`
                ).bind(
                  v.id,
                  v.name,
                  v.plateNumber || v.plate_number || '',
                  v.fuelType || v.fuel_type,
                  v.tankCapacity ?? v.tank_capacity ?? 50,
                  v.initialOdometer ?? v.initial_odometer ?? 0,
                  v.currentOdometer ?? v.current_odometer ?? 0,
                  v.maintenanceIntervalKm ?? v.maintenance_interval_km ?? 10000,
                  v.maintenanceIntervalDays ?? v.maintenance_interval_days ?? 180,
                  v.lastMaintenanceDate || v.last_maintenance_date || null,
                  v.lastMaintenanceOdometer ?? v.last_maintenance_odometer ?? null,
                  v.insuranceExpiryDate || v.insurance_expiry_date || null,
                  v.annualInspectionDate || v.annual_inspection_date || null,
                  v.createdAt || v.created_at || nowIso,
                  v.updatedAt || v.updated_at || nowIso,
                  v.deletedAt || v.deleted_at || null
                )
              );
            }
          }

          // 5. Fuel records
          if (Array.isArray(payload.fuels)) {
            for (const f of payload.fuels) {
              statements.push(
                env.DB.prepare(
                  `INSERT INTO fuel_records (
                    id, vehicle_id, date, odometer, fuel_amount, unit_price, total_cost,
                    is_full_tank, station, fuel_type, calculated_fuel_economy, cost_per_km,
                    trip_distance, notes, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    vehicle_id = excluded.vehicle_id,
                    date = excluded.date,
                    odometer = excluded.odometer,
                    fuel_amount = excluded.fuel_amount,
                    unit_price = excluded.unit_price,
                    total_cost = excluded.total_cost,
                    is_full_tank = excluded.is_full_tank,
                    station = excluded.station,
                    fuel_type = excluded.fuel_type,
                    calculated_fuel_economy = excluded.calculated_fuel_economy,
                    cost_per_km = excluded.cost_per_km,
                    trip_distance = excluded.trip_distance,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at`
                ).bind(
                  f.id,
                  f.vehicleId || f.vehicle_id,
                  f.date,
                  f.odometer ?? 0,
                  f.fuelAmount ?? f.fuel_amount ?? 0,
                  f.unitPrice ?? f.unit_price ?? 0,
                  f.totalCost ?? f.total_cost ?? 0,
                  f.isFullTank !== undefined ? (f.isFullTank ? 1 : 0) : f.is_full_tank ?? 1,
                  f.station || '',
                  f.fuelType || f.fuel_type || '',
                  f.calculatedFuelEconomy ?? f.calculated_fuel_economy ?? null,
                  f.costPerKm ?? f.cost_per_km ?? null,
                  f.tripDistance ?? f.trip_distance ?? null,
                  f.notes || '',
                  f.createdAt || f.created_at || nowIso,
                  f.updatedAt || f.updated_at || nowIso,
                  f.deletedAt || f.deleted_at || null
                )
              );
            }
          }

          // 6. Maintenance records
          if (Array.isArray(payload.maintenances)) {
            for (const m of payload.maintenances) {
              const itemsJson = Array.isArray(m.items)
                ? JSON.stringify(m.items)
                : typeof m.items_json === 'string'
                ? m.items_json
                : JSON.stringify([]);

              statements.push(
                env.DB.prepare(
                  `INSERT INTO maintenance_records (
                    id, vehicle_id, date, odometer, category, title, items_json, shop_name,
                    parts_cost, labor_cost, total_cost, next_service_odometer, next_service_date,
                    notes, created_at, updated_at, deleted_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    vehicle_id = excluded.vehicle_id,
                    date = excluded.date,
                    odometer = excluded.odometer,
                    category = excluded.category,
                    title = excluded.title,
                    items_json = excluded.items_json,
                    shop_name = excluded.shop_name,
                    parts_cost = excluded.parts_cost,
                    labor_cost = excluded.labor_cost,
                    total_cost = excluded.total_cost,
                    next_service_odometer = excluded.next_service_odometer,
                    next_service_date = excluded.next_service_date,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at`
                ).bind(
                  m.id,
                  m.vehicleId || m.vehicle_id,
                  m.date,
                  m.odometer ?? 0,
                  m.category,
                  m.title,
                  itemsJson,
                  m.shopName || m.shop_name || '',
                  m.partsCost ?? m.parts_cost ?? 0,
                  m.laborCost ?? m.labor_cost ?? 0,
                  m.totalCost ?? m.total_cost ?? 0,
                  m.nextServiceOdometer ?? m.next_service_odometer ?? null,
                  m.nextServiceDate || m.next_service_date || null,
                  m.notes || '',
                  m.createdAt || m.created_at || nowIso,
                  m.updatedAt || m.updated_at || nowIso,
                  m.deletedAt || m.deleted_at || null
                )
              );
            }
          }

          // 7. App Settings
          if (payload.settings) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO app_settings (key, value_json, updated_at)
                VALUES ('app_settings', ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                  value_json = excluded.value_json,
                  updated_at = excluded.updated_at`
              ).bind(JSON.stringify(payload.settings), nowIso)
            );
          }

          // 8. Sync Meta update
          statements.push(
            env.DB.prepare(
              `INSERT INTO sync_meta (key, revision, schema_version, last_synced_at, updated_at)
              VALUES ('global', 1, 2, ?, ?)
              ON CONFLICT(key) DO UPDATE SET
                revision = revision + 1,
                last_synced_at = excluded.last_synced_at,
                updated_at = excluded.updated_at`
            ).bind(nowIso, nowIso)
          );

          return statements;
        };

        const executeBatch = async (stmts: D1PreparedStatement[]) => {
          const chunkSize = 50;
          for (let i = 0; i < stmts.length; i += chunkSize) {
            const chunk = stmts.slice(i, i + chunkSize);
            await env.DB.batch(chunk);
          }
        };

        let statements = buildStatements();
        try {
          await executeBatch(statements);
        } catch (postErr: any) {
          // 如果出现表不存在 (no such table)，自动自愈创建表并重新执行
          if (postErr.message && postErr.message.includes('no such table')) {
            await ensureDatabaseSchema(env);
            // 重新构建绑定语句并执行
            statements = buildStatements();
            await executeBatch(statements);
          } else {
            throw postErr;
          }
        }

        const updatedMeta = await env.DB.prepare("SELECT * FROM sync_meta WHERE key = 'global'").first();

        return new Response(
          JSON.stringify({
            success: true,
            syncedAt: nowIso,
            totalProcessed: statements.length,
            syncMeta: updatedMeta,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Endpoint Not Found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: err.message || 'Worker Internal Server Error',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};
