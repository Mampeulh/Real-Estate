// Store en mémoire : données de démo chargées au démarrage.
// Toute modification vit tant que le process tourne (reset au redémarrage).
// Les clés sont en camelCase, au format exposé par l'API.

const properties = [
  {
    id: 'prop_001',
    name: 'Résidence du Vieux-Port',
    type: 'mixed',
    address: { street: '12 rue de la République', postalCode: '13001', city: 'Marseille', country: 'FR' },
    yearBuilt: 1965,
    totalSurfaceM2: 820,
    owner: 'SCI Horizon',
    createdAt: '2024-01-15T09:00:00Z',
  },
  {
    id: 'prop_002',
    name: 'Le Carré Part-Dieu',
    type: 'commercial',
    address: { street: '45 cours Lafayette', postalCode: '69003', city: 'Lyon', country: 'FR' },
    yearBuilt: 2012,
    totalSurfaceM2: 1450,
    owner: 'Foncière Rhône Invest',
    createdAt: '2024-03-02T14:30:00Z',
  },
];

const units = [
  { id: 'unit_001', propertyId: 'prop_001', reference: 'A-101', type: 'apartment', floor: 1, surfaceM2: 45, rooms: 2, status: 'occupied', monthlyRentTarget: 850 },
  { id: 'unit_002', propertyId: 'prop_001', reference: 'A-102', type: 'apartment', floor: 1, surfaceM2: 62, rooms: 3, status: 'occupied', monthlyRentTarget: 1100 },
  { id: 'unit_003', propertyId: 'prop_001', reference: 'B-001', type: 'shop', floor: 0, surfaceM2: 80, rooms: 1, status: 'occupied', monthlyRentTarget: 1900 },
  { id: 'unit_004', propertyId: 'prop_001', reference: 'A-201', type: 'studio', floor: 2, surfaceM2: 24, rooms: 1, status: 'vacant', monthlyRentTarget: 520 },
  { id: 'unit_005', propertyId: 'prop_002', reference: 'O-301', type: 'office', floor: 3, surfaceM2: 120, rooms: 4, status: 'occupied', monthlyRentTarget: 2800 },
  { id: 'unit_006', propertyId: 'prop_002', reference: 'O-302', type: 'office', floor: 3, surfaceM2: 95, rooms: 3, status: 'renovation', monthlyRentTarget: 2200 },
  { id: 'unit_007', propertyId: 'prop_002', reference: 'P-01', type: 'parking', floor: -1, surfaceM2: 12, rooms: 0, status: 'vacant', monthlyRentTarget: 120 },
];

const tenants = [
  { id: 'ten_001', type: 'individual', name: 'Camille Martin', email: 'camille.martin@example.com', phone: '+33 6 12 34 56 78', createdAt: '2025-08-20T10:00:00Z' },
  { id: 'ten_002', type: 'individual', name: 'Lucas Bernard', email: 'lucas.bernard@example.com', phone: '+33 6 98 76 54 32', createdAt: '2022-01-05T08:15:00Z' },
  { id: 'ten_003', type: 'company', name: 'Boulangerie Le Fournil SARL', email: 'contact@lefournil.example.com', phone: '+33 4 91 00 11 22', createdAt: '2023-05-10T11:00:00Z' },
  { id: 'ten_004', type: 'company', name: 'Nova Conseil SAS', email: 'admin@novaconseil.example.com', phone: '+33 4 72 33 44 55', createdAt: '2024-12-01T09:30:00Z' },
];

const leases = [
  { id: 'lease_001', unitId: 'unit_001', tenantId: 'ten_001', startDate: '2025-09-01', endDate: '2028-08-31', monthlyRent: 850, charges: 60, deposit: 850, paymentDay: 5, status: 'active' },
  { id: 'lease_002', unitId: 'unit_002', tenantId: 'ten_002', startDate: '2024-03-01', endDate: null, monthlyRent: 1100, charges: 90, deposit: 1100, paymentDay: 5, status: 'active' },
  { id: 'lease_003', unitId: 'unit_003', tenantId: 'ten_003', startDate: '2023-06-01', endDate: '2032-05-31', monthlyRent: 1900, charges: 150, deposit: 3800, paymentDay: 1, status: 'active' },
  { id: 'lease_004', unitId: 'unit_005', tenantId: 'ten_004', startDate: '2025-01-01', endDate: '2027-12-31', monthlyRent: 2800, charges: 300, deposit: 5600, paymentDay: 1, status: 'active' },
  { id: 'lease_005', unitId: 'unit_004', tenantId: 'ten_002', startDate: '2022-01-01', endDate: '2024-02-29', monthlyRent: 500, charges: 40, deposit: 500, paymentDay: 5, status: 'terminated' },
];

// Échéances de juillet à octobre 2026 pour les baux actifs.
// Par défaut tout est payé ; les exceptions sont listées ici.
const exceptions = {
  'lease_002:2026-09': { status: 'late', amountPaid: 0 },
  'lease_001:2026-10': { status: 'late', amountPaid: 0 },
  'lease_002:2026-10': { status: 'partial', amountPaid: 500 },
};

const payments = [];
let counter = 1;
['2026-07', '2026-08', '2026-09', '2026-10'].forEach((period) => {
  leases
    .filter((l) => l.status === 'active')
    .forEach((l) => {
      const amountDue = l.monthlyRent + l.charges;
      const dueDate = `${period}-${String(l.paymentDay).padStart(2, '0')}`;
      const exception = exceptions[`${l.id}:${period}`];
      const payment = {
        id: `pay_${String(counter).padStart(3, '0')}`,
        leaseId: l.id,
        period,
        amountDue,
        amountPaid: exception ? exception.amountPaid : amountDue,
        dueDate,
        paidDate: exception ? (exception.amountPaid > 0 ? '2026-10-12' : null) : dueDate,
        status: exception ? exception.status : 'paid',
      };
      payments.push(payment);
      counter += 1;
    });
});

module.exports = { properties, units, tenants, leases, payments };
