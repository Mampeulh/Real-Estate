// Règles métier partagées : suppressions en cascade, statuts dérivés, synthèse.
const store = require('./store');

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round(n * 100) / 100;

function removeWhere(list, predicate) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (predicate(list[i])) list.splice(i, 1);
  }
}

function removeLeaseCascade(leaseId) {
  removeWhere(store.payments, (p) => p.leaseId === leaseId);
  removeWhere(store.leases, (l) => l.id === leaseId);
}

function removeUnitCascade(unitId) {
  store.leases.filter((l) => l.unitId === unitId).map((l) => l.id).forEach(removeLeaseCascade);
  removeWhere(store.units, (u) => u.id === unitId);
}

function removePropertyCascade(propertyId) {
  store.units.filter((u) => u.propertyId === propertyId).map((u) => u.id).forEach(removeUnitCascade);
  removeWhere(store.properties, (p) => p.id === propertyId);
}

// Un lot est "occupied" tant qu'un bail actif existe ; sinon il redevient "vacant"
// (les lots en "renovation" ne sont pas touchés).
function syncUnitStatus(unitId) {
  const unit = store.units.find((u) => u.id === unitId);
  if (!unit) return;
  const hasActiveLease = store.leases.some((l) => l.unitId === unitId && l.status === 'active');
  if (hasActiveLease) unit.status = 'occupied';
  else if (unit.status === 'occupied') unit.status = 'vacant';
}

function deriveLeaseStatus(lease) {
  const now = today();
  if (lease.endDate && lease.endDate < now) return 'terminated';
  if (lease.startDate > now) return 'upcoming';
  return 'active';
}

function derivePaymentStatus(payment) {
  if (payment.amountPaid >= payment.amountDue) return 'paid';
  if (payment.amountPaid > 0) return 'partial';
  return payment.dueDate < today() ? 'late' : 'pending';
}

function propertySummary(propertyId) {
  const units = store.units.filter((u) => u.propertyId === propertyId);
  const unitIds = new Set(units.map((u) => u.id));
  const leases = store.leases.filter((l) => unitIds.has(l.unitId));
  const leaseIds = new Set(leases.map((l) => l.id));
  const payments = store.payments.filter((p) => leaseIds.has(p.leaseId));

  const occupiedUnits = units.filter((u) => u.status === 'occupied').length;
  const monthlyRentRoll = leases
    .filter((l) => l.status === 'active')
    .reduce((sum, l) => sum + l.monthlyRent + (l.charges || 0), 0);
  const unpaid = payments.filter((p) => p.status !== 'paid');

  return {
    propertyId,
    unitsCount: units.length,
    occupiedUnits,
    occupancyRate: units.length ? Math.round((occupiedUnits / units.length) * 10000) / 10000 : 0,
    monthlyRentRoll: round2(monthlyRentRoll),
    outstandingAmount: round2(unpaid.reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0)),
    lateCount: payments.filter((p) => p.status === 'late').length,
  };
}

module.exports = {
  today,
  removeLeaseCascade,
  removeUnitCascade,
  removePropertyCascade,
  syncUnitStatus,
  deriveLeaseStatus,
  derivePaymentStatus,
  propertySummary,
};
