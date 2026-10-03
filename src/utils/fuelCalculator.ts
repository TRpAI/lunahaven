import { FuelRecord, MaintenanceRecord, VehicleProfile } from '../types';

/**
 * 重新计算加油记录的百公里油耗 (L/100km 或 kWh/100km) 和每公里花费
 * 根据相邻两次加满 (Full Tank) 进行精确计算，若未加满则进行加权估算
 */
export function processFuelRecords(records: FuelRecord[]): FuelRecord[] {
  if (!records || records.length === 0) return [];

  // 按里程升序排序计算，之后返回按日期/里程降序
  const sorted = [...records].sort((a, b) => a.odometer - b.odometer);

  let lastFullOdometer: number | null = null;
  let accumulatedFuelSinceFull = 0;
  let accumulatedCostSinceFull = 0;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;

    if (prev) {
      current.tripDistance = Math.max(0, current.odometer - prev.odometer);
    } else {
      current.tripDistance = 0;
    }

    if (current.isMissedPrevious) {
      // 若用户标记遗漏了上一次补能记录，则断开前序关联，重新开始标定基准
      current.calculatedFuelEconomy = undefined;
      current.costPerKm = undefined;
      accumulatedFuelSinceFull = 0;
      accumulatedCostSinceFull = 0;
      lastFullOdometer = current.isFullTank ? current.odometer : null;
      continue;
    }

    if (current.isFullTank) {
      if (lastFullOdometer !== null) {
        const deltaDistance = current.odometer - lastFullOdometer;
        const totalFuel = accumulatedFuelSinceFull + current.fuelAmount;
        const totalCost = accumulatedCostSinceFull + current.totalCost;

        if (deltaDistance > 0) {
          current.calculatedFuelEconomy = Math.round(((totalFuel * 100) / deltaDistance) * 100) / 100;
          current.costPerKm = Math.round((totalCost / deltaDistance) * 100) / 100;
        }
      }
      lastFullOdometer = current.odometer;
      accumulatedFuelSinceFull = 0;
      accumulatedCostSinceFull = 0;
    } else {
      accumulatedFuelSinceFull += current.fuelAmount;
      accumulatedCostSinceFull += current.totalCost;
      if (current.tripDistance && current.tripDistance > 0 && current.fuelAmount > 0) {
        current.calculatedFuelEconomy = Math.round(((current.fuelAmount * 100) / current.tripDistance) * 100) / 100;
        current.costPerKm = Math.round((current.totalCost / current.tripDistance) * 100) / 100;
      }
    }
  }

  // 默认降序返回最新在最前
  return sorted.reverse();
}

/**
 * 计算车辆保养健康状况与提醒预警
 */
export function getVehicleHealthStatus(
  vehicle: VehicleProfile,
  latestFuelOdometer: number,
  maintenances: MaintenanceRecord[]
) {
  const currentOdometer = Math.max(vehicle.currentOdometer || 0, latestFuelOdometer || 0, vehicle.initialOdometer || 0);

  // 寻找该车辆最近一次保养
  const vehicleMaintenances = maintenances
    .filter((m) => m.vehicleId === vehicle.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.odometer - a.odometer);

  const lastMaint = vehicleMaintenances[0];
  const lastMaintOdo = lastMaint ? lastMaint.odometer : vehicle.lastMaintenanceOdometer || vehicle.initialOdometer || 0;
  const lastMaintDateStr = lastMaint ? lastMaint.date : vehicle.lastMaintenanceDate || vehicle.createdAt;

  const intervalKm = vehicle.maintenanceIntervalKm || 10000;
  const intervalDays = vehicle.maintenanceIntervalDays || 180;

  const drivenSinceMaint = Math.max(0, currentOdometer - lastMaintOdo);
  const remainingKm = intervalKm - drivenSinceMaint;

  const lastMaintTime = new Date(lastMaintDateStr).getTime();
  const nowTime = new Date().getTime();
  const daysSinceMaint = Math.floor((nowTime - lastMaintTime) / (1000 * 60 * 60 * 24));
  const remainingDays = intervalDays - daysSinceMaint;

  // 状态等级: ok, warning (<1000km 或 <30天), overdue (<=0)
  let status: 'ok' | 'warning' | 'overdue' = 'ok';
  let message = '车况良好，按时保养';

  if (remainingKm <= 0 || remainingDays <= 0) {
    status = 'overdue';
    message = `已超出保养周期！(超期 ${Math.abs(remainingDays)} 天 / 超程 ${Math.abs(remainingKm)} km)`;
  } else if (remainingKm < 1000 || remainingDays < 30) {
    status = 'warning';
    message = `即将需要保养 (剩余 ${remainingKm} km / ${remainingDays} 天)`;
  }

  return {
    currentOdometer,
    lastMaintenanceOdometer: lastMaintOdo,
    lastMaintenanceDate: lastMaintDateStr,
    drivenSinceMaint,
    remainingKm,
    remainingDays,
    status,
    message,
    totalMaintenanceCount: vehicleMaintenances.length,
    totalMaintenanceCost: vehicleMaintenances.reduce((acc, cur) => acc + (cur.totalCost || 0), 0),
  };
}
