// Configuration des 5 ressources : champs, validations, règles métier.
const store = require('./store');
const domain = require('./domain');
const { createCrud, validators: v } = require('./crud');
const { ApiError } = require('./middleware/errorHandler');

const PROPERTY_TYPES = ['residential', 'commercial', 'mixed'];
const UNIT_TYPES = ['apartment', 'studio', 'office', 'shop', 'parking'];
const UNIT_STATUSES = ['vacant', 'occupied', 'renovation'];
const TENANT_TYPES = ['individual', 'company'];
const LEASE_STATUSES = ['upcoming', 'active', 'terminated'];
const PAYMENT_STATUSES = ['pending', 'paid', 'partial', 'late'];

const now = () => new Date().toISOString();
const byDateDesc = (field) => (a, b) => (a[field] < b[field] ? 1 : a[field] > b[field] ? -1 : 0);

const properties = createCrud({
  label: 'Propriété',
  collection: 'properties',
  prefix: 'prop',
  idParam: 'propertyId',
  fields: ['name', 'type', 'address', 'yearBuilt', 'totalSurfaceM2', 'owner'],
  required: ['name', 'type', 'address'],
  validators: {
    name: v.string,
    type: v.oneOf(PROPERTY_TYPES),
    address: v.address,
    yearBuilt: v.int(1000, 2100),
    totalSurfaceM2: v.number,
    owner: v.string,
  },
  filters: {
    type: 'type',
    city: (item, value) => item.address.city.toLowerCase() === String(value).toLowerCase(),
  },
  defaults: { createdAt: now },
  sort: (a, b) => a.name.localeCompare(b.name),
  remove: (item) => domain.removePropertyCascade(item.id),
});

const units = createCrud({
  label: 'Lot',
  collection: 'units',
  prefix: 'unit',
  idParam: 'unitId',
  fields: ['propertyId', 'reference', 'type', 'floor', 'surfaceM2', 'rooms', 'status', 'monthlyRentTarget'],
  required: ['propertyId', 'reference', 'type', 'surfaceM2'],
  validators: {
    propertyId: v.string,
    reference: v.string,
    type: v.oneOf(UNIT_TYPES),
    floor: v.int(-10, 200),
    surfaceM2: v.number,
    rooms: v.int(0, 100),
    status: v.oneOf(UNIT_STATUSES),
    monthlyRentTarget: v.number,
  },
  refs: [{ field: 'propertyId', collection: 'properties', label: 'propriété' }],
  filters: { propertyId: 'propertyId', status: 'status', type: 'type' },
  defaults: { status: 'vacant' },
  check: (candidate, existing) => {
    const duplicate = store.units.some(
      (u) => u.id !== (existing && existing.id) && u.propertyId === candidate.propertyId && u.reference === candidate.reference,
    );
    if (duplicate) throw new ApiError(409, 'CONFLICT', 'Un lot avec cette référence existe déjà dans cette propriété.');
  },
  remove: (item) => domain.removeUnitCascade(item.id),
});

const tenants = createCrud({
  label: 'Locataire',
  collection: 'tenants',
  prefix: 'ten',
  idParam: 'tenantId',
  fields: ['type', 'name', 'email', 'phone'],
  required: ['type', 'name', 'email'],
  validators: { type: v.oneOf(TENANT_TYPES), name: v.string, email: v.email, phone: v.string },
  filters: { type: 'type' },
  defaults: { createdAt: now },
  sort: (a, b) => a.name.localeCompare(b.name),
  canDelete: (item) => {
    if (store.leases.some((l) => l.tenantId === item.id && l.status === 'active')) {
      throw new ApiError(409, 'CONFLICT', 'Ce locataire a un bail actif et ne peut pas être supprimé.');
    }
  },
  remove: (item) => {
    store.leases.filter((l) => l.tenantId === item.id).map((l) => l.id).forEach((leaseId) => {
      const lease = store.leases.find((l) => l.id === leaseId);
      domain.removeLeaseCascade(leaseId);
      if (lease) domain.syncUnitStatus(lease.unitId);
    });
    store.tenants.splice(store.tenants.indexOf(item), 1);
  },
});

const leases = createCrud({
  label: 'Bail',
  collection: 'leases',
  prefix: 'lease',
  idParam: 'leaseId',
  fields: ['unitId', 'tenantId', 'startDate', 'endDate', 'monthlyRent', 'charges', 'deposit', 'paymentDay', 'status'],
  required: ['unitId', 'tenantId', 'startDate', 'monthlyRent'],
  validators: {
    unitId: v.string,
    tenantId: v.string,
    startDate: v.date,
    endDate: v.nullableDate,
    monthlyRent: v.number,
    charges: v.number,
    deposit: v.number,
    paymentDay: v.int(1, 28),
    status: v.oneOf(LEASE_STATUSES),
  },
  refs: [
    { field: 'unitId', collection: 'units', label: 'lot' },
    { field: 'tenantId', collection: 'tenants', label: 'locataire' },
  ],
  filters: { unitId: 'unitId', tenantId: 'tenantId', status: 'status' },
  defaults: { endDate: null, charges: 0, deposit: 0, paymentDay: 5 },
  sort: byDateDesc('startDate'),
  normalize: (candidate, data) => {
    // Statut déduit des dates si le client ne le fournit pas
    if (data.status === undefined) candidate.status = domain.deriveLeaseStatus(candidate);
  },
  check: (candidate, existing) => {
    if (candidate.endDate && candidate.endDate < candidate.startDate) {
      throw new ApiError(400, 'INVALID_INPUT', 'endDate doit être postérieure ou égale à startDate.');
    }
    if (candidate.status === 'active') {
      const other = store.leases.find(
        (l) => l.unitId === candidate.unitId && l.status === 'active' && l.id !== (existing && existing.id),
      );
      if (other) throw new ApiError(409, 'CONFLICT', `Ce lot a déjà un bail actif (${other.id}).`);
    }
  },
  afterSave: (lease, previous) => {
    domain.syncUnitStatus(lease.unitId);
    if (previous && previous.unitId !== lease.unitId) domain.syncUnitStatus(previous.unitId);
  },
  remove: (item) => {
    domain.removeLeaseCascade(item.id);
    domain.syncUnitStatus(item.unitId);
  },
});

const payments = createCrud({
  label: 'Loyer',
  collection: 'payments',
  prefix: 'pay',
  idParam: 'paymentId',
  fields: ['leaseId', 'period', 'amountDue', 'amountPaid', 'dueDate', 'paidDate', 'status'],
  required: ['leaseId', 'period', 'amountDue', 'dueDate'],
  validators: {
    leaseId: v.string,
    period: v.period,
    amountDue: v.number,
    amountPaid: v.number,
    dueDate: v.date,
    paidDate: v.nullableDate,
    status: v.oneOf(PAYMENT_STATUSES),
  },
  refs: [{ field: 'leaseId', collection: 'leases', label: 'bail' }],
  filters: { leaseId: 'leaseId', status: 'status', period: 'period' },
  defaults: { amountPaid: 0, paidDate: null },
  sort: (a, b) => (a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : 0),
  normalize: (candidate, data) => {
    // Statut déduit des montants si le client ne le fournit pas
    if (data.status === undefined) candidate.status = domain.derivePaymentStatus(candidate);
    if (candidate.status === 'paid' && !candidate.paidDate) candidate.paidDate = domain.today();
  },
  check: (candidate, existing) => {
    const duplicate = store.payments.some(
      (p) => p.id !== (existing && existing.id) && p.leaseId === candidate.leaseId && p.period === candidate.period,
    );
    if (duplicate) throw new ApiError(409, 'CONFLICT', 'Une échéance existe déjà pour ce bail et cette période.');
  },
  remove: (item) => store.payments.splice(store.payments.indexOf(item), 1),
});

module.exports = { properties, units, tenants, leases, payments };
