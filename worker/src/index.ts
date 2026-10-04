import { getCorsHeaders, verifyAuthorization } from './auth';
import { ensureD1Schema } from './schema';
import { Env, SyncPayload, D1PreparedStatement } from './types';
import { createErrorResponse, createSuccessResponse, validateSyncPayload } from './validation';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const corsHeaders = getCorsHeaders(request, env);

    // 1. 处理 CORS Preflight 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 2. 生产级健康检查接口 (GET /api/health)
    // 同时探测 Worker 运行状态与 D1 数据库连接可用性
    if (url.pathname === '/api/health') {
      if (!env.DB) {
        return createErrorResponse(
          503,
          'DATABASE_NOT_BOUND',
          "Cloudflare Worker 未绑定 D1 数据库变量 (env.DB is undefined)。请在 Cloudflare 仪表盘 Worker -> Settings -> Bindings 中添加 D1 数据库绑定，Variable name 必须设置为 'DB'",
          requestId,
          corsHeaders,
          { worker: 'ok', database: 'unbound' }
        );
      }

      try {
        let meta = await env.DB.prepare(
          "SELECT key, revision, schema_version, last_synced_at FROM sync_meta WHERE key = 'global'"
        ).first().catch(() => null);

        if (!meta) {
          await ensureD1Schema(env.DB);
          meta = await env.DB.prepare(
            "SELECT key, revision, schema_version, last_synced_at FROM sync_meta WHERE key = 'global'"
          ).first().catch(() => null);
        }

        return createSuccessResponse(
          {
            status: 'healthy',
            worker: 'ok',
            database: 'connected',
            schemaVersion: meta?.schema_version ?? 2,
            revision: meta?.revision ?? 1,
            lastSyncedAt: meta?.last_synced_at ?? null,
          },
          requestId,
          corsHeaders,
          { service: 'qiyue-ledger-d1-api', version: '2.1.0' }
        );
      } catch (err: any) {
        console.error(`[${requestId}] Health check D1 error:`, err);
        return createErrorResponse(
          503,
          'DATABASE_UNHEALTHY',
          `D1 数据库连接异常: ${err?.message || err}`,
          requestId,
          corsHeaders,
          { worker: 'ok', database: 'disconnected' }
        );
      }
    }

    // 3. 严格身份认证校验 (P0)
    const authResult = verifyAuthorization(request, env);
    if (!authResult.authorized) {
      return createErrorResponse(
        authResult.status || 401,
        authResult.errorCode || 'UNAUTHORIZED',
        authResult.errorMessage || 'Unauthorized',
        requestId,
        corsHeaders
      );
    }

    // 验证 D1 数据库绑定
    if (!env.DB) {
      return createErrorResponse(
        503,
        'DATABASE_NOT_BOUND',
        "Worker 未绑定 D1 数据库变量 (env.DB is undefined)。请在 Cloudflare 仪表盘 Worker -> Settings -> Bindings 中添加 D1 数据库绑定，Variable name 必须设置为 'DB'",
        requestId,
        corsHeaders
      );
    }

    try {
      // 自动确保 D1 表结构已就绪 (自愈机制)
      await ensureD1Schema(env.DB);
      // 3.1 手动一键初始化/修复表结构端点 (POST /api/init)
      if (request.method === 'POST' && url.pathname === '/api/init') {
        const ok = await ensureD1Schema(env.DB);
        return createSuccessResponse(
          {
            initialized: ok,
            message: ok ? 'D1 数据库表结构已全部初始化就绪' : '初始化执行失败',
          },
          requestId,
          corsHeaders
        );
      }
      // 4. GET /api/sync - 支持全量与增量 (since) 数据拉取
      if (request.method === 'GET' && url.pathname === '/api/sync') {
        const since = url.searchParams.get('since');
        const isIncremental = Boolean(since && since.trim());

        let salariesRes, overtimesRes, expensesRes, giftsRes, vehiclesRes, fuelsRes, maintenancesRes, settingsRes, syncMetaRes;

        if (isIncremental) {
          // 增量模式：拉取 since 之后变动或软删除的记录
          const sinceIso = since!.trim();
          [
            salariesRes,
            overtimesRes,
            expensesRes,
            giftsRes,
            vehiclesRes,
            fuelsRes,
            maintenancesRes,
            settingsRes,
            syncMetaRes,
          ] = await Promise.all([
            env.DB.prepare('SELECT * FROM salaries WHERE updated_at > ? ORDER BY updated_at ASC').bind(sinceIso).all(),
            env.DB.prepare('SELECT * FROM overtimes WHERE updated_at > ? ORDER BY updated_at ASC').bind(sinceIso).all(),
            env.DB.prepare('SELECT * FROM expenses WHERE updated_at > ? ORDER BY updated_at ASC').bind(sinceIso).all(),
            env.DB.prepare('SELECT * FROM social_gifts WHERE updated_at > ? ORDER BY updated_at ASC').bind(sinceIso).all(),
            env.DB.prepare('SELECT * FROM vehicles WHERE updated_at > ? ORDER BY updated_at ASC').bind(sinceIso).all(),
            env.DB.prepare('SELECT * FROM fuel_records WHERE updated_at > ? ORDER BY updated_at ASC').bind(sinceIso).all(),
            env.DB.prepare('SELECT * FROM maintenance_records WHERE updated_at > ? ORDER BY updated_at ASC').bind(sinceIso).all(),
            env.DB.prepare('SELECT * FROM app_settings WHERE updated_at > ?').bind(sinceIso).all(),
            env.DB.prepare("SELECT * FROM sync_meta WHERE key = 'global'").first(),
          ]);
        } else {
          // 全量模式：拉取未删除的有效业务数据
          [
            salariesRes,
            overtimesRes,
            expensesRes,
            giftsRes,
            vehiclesRes,
            fuelsRes,
            maintenancesRes,
            settingsRes,
            syncMetaRes,
          ] = await Promise.all([
            env.DB.prepare('SELECT * FROM salaries WHERE deleted_at IS NULL ORDER BY month DESC').all(),
            env.DB.prepare('SELECT * FROM overtimes WHERE deleted_at IS NULL ORDER BY date DESC').all(),
            env.DB.prepare('SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY date DESC').all(),
            env.DB.prepare('SELECT * FROM social_gifts WHERE deleted_at IS NULL ORDER BY date DESC').all(),
            env.DB.prepare('SELECT * FROM vehicles WHERE deleted_at IS NULL').all(),
            env.DB.prepare('SELECT * FROM fuel_records WHERE deleted_at IS NULL ORDER BY date DESC').all(),
            env.DB.prepare('SELECT * FROM maintenance_records WHERE deleted_at IS NULL ORDER BY date DESC').all(),
            env.DB.prepare('SELECT * FROM app_settings').all(),
            env.DB.prepare("SELECT * FROM sync_meta WHERE key = 'global'").first(),
          ]);
        }

        const totalReturned =
          (salariesRes.results?.length || 0) +
          (overtimesRes.results?.length || 0) +
          (expensesRes.results?.length || 0) +
          (giftsRes.results?.length || 0) +
          (vehiclesRes.results?.length || 0) +
          (fuelsRes.results?.length || 0) +
          (maintenancesRes.results?.length || 0);

        // 异步记录审计日志 (不阻塞正常响应)
        try {
          const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
          const userAgent = request.headers.get('User-Agent') || '';
          await env.DB.prepare(
            `INSERT INTO audit_logs (id, action, resource, record_count, ip_hash, user_agent, created_at)
             VALUES (?, 'SYNC_PULL', 'batch', ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            totalReturned,
            clientIp.slice(0, 16),
            userAgent.slice(0, 64),
            new Date().toISOString()
          ).run();
        } catch {
          // 审计日志写入容错
        }

        return createSuccessResponse(
          {
            salaries: salariesRes.results || [],
            overtimes: overtimesRes.results || [],
            expenses: expensesRes.results || [],
            gifts: giftsRes.results || [],
            vehicles: vehiclesRes.results || [],
            fuels: fuelsRes.results || [],
            maintenances: maintenancesRes.results || [],
            settings: settingsRes.results || [],
            syncMeta: syncMetaRes || { key: 'global', revision: 1, schema_version: 2 },
          },
          requestId,
          corsHeaders,
          {
            isIncremental,
            since: isIncremental ? since : null,
            totalRecords: totalReturned,
          }
        );
      }

      // 5. POST /api/sync - 客户端数据批量推送入库
      if (request.method === 'POST' && url.pathname === '/api/sync') {
        const payload: SyncPayload = await request.json();

        // 5.1 数据 Schema 严格校验
        const validation = validateSyncPayload(payload);
        if (!validation.valid) {
          return createErrorResponse(
            400,
            'VALIDATION_ERROR',
            '提交的数据结构未通过校验，请检查字段格式',
            requestId,
            corsHeaders,
            validation.errors
          );
        }

        const nowIso = new Date().toISOString();
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
            const isFull = f.isFullTank !== undefined ? (f.isFullTank ? 1 : 0) : f.is_full_tank ?? 1;
            const isWarning = f.isWarningLightOn !== undefined ? (f.isWarningLightOn ? 1 : 0) : f.is_warning_light_on ?? 0;
            const isMissed = f.isMissedPrevious !== undefined ? (f.isMissedPrevious ? 1 : 0) : f.is_missed_previous ?? 0;

            statements.push(
              env.DB.prepare(
                `INSERT INTO fuel_records (
                  id, vehicle_id, date, odometer, fuel_amount, unit_price, total_cost,
                  is_full_tank, is_warning_light_on, is_missed_previous, station, fuel_type,
                  calculated_fuel_economy, cost_per_km, trip_distance, notes,
                  created_at, updated_at, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  vehicle_id = excluded.vehicle_id,
                  date = excluded.date,
                  odometer = excluded.odometer,
                  fuel_amount = excluded.fuel_amount,
                  unit_price = excluded.unit_price,
                  total_cost = excluded.total_cost,
                  is_full_tank = excluded.is_full_tank,
                  is_warning_light_on = excluded.is_warning_light_on,
                  is_missed_previous = excluded.is_missed_previous,
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
                isFull,
                isWarning,
                isMissed,
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

        // 7. Expenses (日常生活与教育/专项开销)
        if (Array.isArray(payload.expenses)) {
          for (const exp of payload.expenses) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO expenses (
                  id, date, type, category, amount, direction, payer, payment_method, beneficiary,
                  remarks, created_at, updated_at, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  date = excluded.date,
                  type = excluded.type,
                  category = excluded.category,
                  amount = excluded.amount,
                  direction = excluded.direction,
                  payer = excluded.payer,
                  payment_method = excluded.payment_method,
                  beneficiary = excluded.beneficiary,
                  remarks = excluded.remarks,
                  updated_at = excluded.updated_at,
                  deleted_at = excluded.deleted_at`
              ).bind(
                exp.id,
                exp.date,
                exp.type,
                exp.category,
                exp.amount ?? 0,
                exp.direction || 'out',
                exp.payer || '',
                exp.paymentMethod || exp.payment_method || '',
                exp.beneficiary || '',
                exp.remarks || '',
                exp.createdAt || exp.created_at || nowIso,
                exp.updatedAt || exp.updated_at || nowIso,
                exp.deletedAt || exp.deleted_at || null
              )
            );
          }
        }

        // 8. App Settings
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

        // 9. 同步版本元数据推进 (Revision Increment)
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

        // 5.2 批量事务执行 (每批 50 条防超限)
        const chunkSize = 50;
        for (let i = 0; i < statements.length; i += chunkSize) {
          const chunk = statements.slice(i, i + chunkSize);
          await env.DB.batch(chunk);
        }

        const updatedMeta = await env.DB.prepare("SELECT * FROM sync_meta WHERE key = 'global'").first();

        // 5.3 记录同步审计
        try {
          const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
          const userAgent = request.headers.get('User-Agent') || '';
          await env.DB.prepare(
            `INSERT INTO audit_logs (id, action, resource, record_count, ip_hash, user_agent, created_at)
             VALUES (?, 'SYNC_PUSH', 'batch', ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            statements.length,
            clientIp.slice(0, 16),
            userAgent.slice(0, 64),
            nowIso
          ).run();
        } catch {
          // 容错
        }

        return createSuccessResponse(
          {
            syncedAt: nowIso,
            totalProcessed: statements.length,
            syncMeta: updatedMeta,
          },
          requestId,
          corsHeaders
        );
      }

      return createErrorResponse(404, 'NOT_FOUND', '请求的 API 路由端点不存在', requestId, corsHeaders);
    } catch (err: any) {
      console.error(`[${requestId}] Worker Internal Error:`, err);
      const detail = err?.message || String(err);
      return createErrorResponse(
        500,
        'DATABASE_ERROR',
        `数据库操作异常: ${detail}`,
        requestId,
        corsHeaders
      );
    }
  },
};
