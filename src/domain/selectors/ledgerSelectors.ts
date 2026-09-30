import { FuelRecord, MaintenanceRecord, OvertimeRecord, SocialGiftRecord, VehicleProfile } from '../../types';
import { getVehicleHealthStatus } from '../../utils/fuelCalculator';

/**
 * Derive accurate current odometer from fuel & maintenance records
 */
export function selectVehicleCurrentOdometer(
  vehicle: VehicleProfile,
  fuels: FuelRecord[],
  maintenances: MaintenanceRecord[]
): number {
  const vehicleFuels = fuels.filter((f) => f.vehicleId === vehicle.id && !f.deletedAt);
  const vehicleMaints = maintenances.filter((m) => m.vehicleId === vehicle.id && !m.deletedAt);

  const maxFuelOdo = vehicleFuels.length > 0 ? Math.max(...vehicleFuels.map((f) => f.odometer)) : 0;
  const maxMaintOdo = vehicleMaints.length > 0 ? Math.max(...vehicleMaints.map((m) => m.odometer)) : 0;

  return Math.max(vehicle.initialOdometer || 0, vehicle.currentOdometer || 0, maxFuelOdo, maxMaintOdo);
}

/**
 * Calculate available comp-time balance
 */
export function selectCompTimeBalance(overtimes: OvertimeRecord[]): {
  totalHours: number;
  compTimeTotal: number;
  compTimeUsed: number;
  compTimeAvailable: number;
  totalPaidPay: number;
} {
  const active = overtimes.filter((o) => !o.deletedAt);
  const totalHours = active.reduce((acc, o) => acc + o.durationHours, 0);

  const compTimeOvertimes = active.filter((o) => o.settlementType === 'comp_time');
  const compTimeTotal = compTimeOvertimes.reduce((acc, o) => acc + o.durationHours, 0);
  const compTimeUsed = compTimeOvertimes.reduce((acc, o) => acc + (o.compTimeHoursUsed || 0), 0);
  const compTimeAvailable = Math.max(0, compTimeTotal - compTimeUsed);

  const totalPaidPay = active
    .filter((o) => o.settlementType === 'paid')
    .reduce((acc, o) => acc + (o.estimatedPay || 0), 0);

  return {
    totalHours,
    compTimeTotal,
    compTimeUsed,
    compTimeAvailable,
    totalPaidPay,
  };
}

/**
 * Calculate social gifts financial balance
 */
export function selectGiftsBalance(gifts: SocialGiftRecord[]): {
  totalOut: number;
  totalIn: number;
  netBalance: number;
  pendingReturnCount: number;
} {
  const active = gifts.filter((g) => !g.deletedAt);
  const totalOut = active.filter((g) => g.direction === 'out').reduce((acc, g) => acc + g.amount, 0);
  const totalIn = active.filter((g) => g.direction === 'in').reduce((acc, g) => acc + g.amount, 0);
  const netBalance = totalIn - totalOut;
  const pendingReturnCount = active.filter((g) => g.direction === 'in' && g.returnStatus === 'pending').length;

  return {
    totalOut,
    totalIn,
    netBalance,
    pendingReturnCount,
  };
}

/**
 * Select unified vehicle health metrics
 */
export function selectVehicleHealth(
  vehicle: VehicleProfile,
  fuels: FuelRecord[],
  maintenances: MaintenanceRecord[]
) {
  const currentOdo = selectVehicleCurrentOdometer(vehicle, fuels, maintenances);
  const vehicleMaints = maintenances.filter((m) => m.vehicleId === vehicle.id && !m.deletedAt);
  return getVehicleHealthStatus(vehicle, currentOdo, vehicleMaints);
}
