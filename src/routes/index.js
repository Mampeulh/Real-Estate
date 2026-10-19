const express = require('express');
const store = require('../store');
const domain = require('../domain');
const resources = require('../resources');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

function crudRoutes(base, idParam, crud) {
  router.get(base, crud.list);
  router.post(base, crud.create);
  router.get(`${base}/:${idParam}`, crud.getById);
  router.put(`${base}/:${idParam}`, crud.update);
  router.delete(`${base}/:${idParam}`, crud.remove);
}

crudRoutes('/properties', 'propertyId', resources.properties);
crudRoutes('/units', 'unitId', resources.units);
crudRoutes('/tenants', 'tenantId', resources.tenants);
crudRoutes('/leases', 'leaseId', resources.leases);
crudRoutes('/payments', 'paymentId', resources.payments);

function requireProperty(req) {
  const property = store.properties.find((p) => p.id === req.params.propertyId);
  if (!property) throw new ApiError(404, 'NOT_FOUND', 'Propriété non trouvée.');
  return property;
}

router.get('/properties/:propertyId/units', (req, res) => {
  const property = requireProperty(req);
  res.json(store.units.filter((u) => u.propertyId === property.id));
});

router.get('/properties/:propertyId/summary', (req, res) => {
  const property = requireProperty(req);
  res.json(domain.propertySummary(property.id));
});

router.get('/leases/:leaseId/payments', (req, res) => {
  const lease = store.leases.find((l) => l.id === req.params.leaseId);
  if (!lease) throw new ApiError(404, 'NOT_FOUND', 'Bail non trouvé.');
  res.json(store.payments.filter((p) => p.leaseId === lease.id).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)));
});

module.exports = router;
