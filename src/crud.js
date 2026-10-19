// Fabrique de handlers CRUD pour une collection du store en mémoire.
const crypto = require('crypto');
const store = require('./store');
const { ApiError } = require('./middleware/errorHandler');

const newId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const isBlank = (v) => v === undefined || v === null || v === '';

const v = {
  string: (x) => (typeof x === 'string' && x.trim() ? null : 'chaîne non vide attendue'),
  email: (x) => (typeof x === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x) ? null : 'email invalide'),
  number: (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? null : 'nombre positif ou nul attendu'),
  int: (min, max) => (x) =>
    Number.isInteger(x) && (min === undefined || x >= min) && (max === undefined || x <= max)
      ? null
      : `entier attendu${min !== undefined ? ` entre ${min} et ${max}` : ''}`,
  date: (x) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) ? null : 'date attendue (YYYY-MM-DD)'),
  nullableDate: (x) => (x === null ? null : v.date(x)),
  period: (x) => (typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x) ? null : 'période attendue (YYYY-MM)'),
  oneOf: (list) => (x) => (list.includes(x) ? null : `valeur attendue parmi : ${list.join(', ')}`),
  address: (x) => {
    const ok = x && typeof x === 'object' && ['street', 'postalCode', 'city', 'country'].every((k) => typeof x[k] === 'string' && x[k].trim());
    return ok ? null : 'objet attendu avec street, postalCode, city, country';
  },
};

function createCrud(config) {
  const {
    collection, prefix, idParam, fields, required = [], validators = {}, refs = [], filters = {},
    defaults = {}, sort, normalize, check, afterSave, canDelete, remove,
  } = config;
  const items = () => store[collection];

  function readBody(req) {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const data = {};
    fields.forEach((f) => {
      if (body[f] !== undefined) data[f] = body[f];
    });
    return data;
  }

  function validate(data, { creating }) {
    if (creating) {
      const missing = required.filter((f) => isBlank(data[f]));
      if (missing.length) throw new ApiError(400, 'INVALID_INPUT', `Champs requis : ${missing.join(', ')}.`);
    }
    Object.keys(data).forEach((f) => {
      if (validators[f]) {
        const error = validators[f](data[f]);
        if (error) throw new ApiError(400, 'INVALID_INPUT', `Champ "${f}" invalide : ${error}.`);
      }
    });
    refs.forEach(({ field, collection: target, label }) => {
      if (data[field] !== undefined && !store[target].some((x) => x.id === data[field])) {
        throw new ApiError(400, 'INVALID_REFERENCE', `${field} ne correspond à aucun(e) ${label} existant(e).`);
      }
    });
  }

  function find(req) {
    const item = items().find((x) => x.id === req.params[idParam]);
    if (!item) throw new ApiError(404, 'NOT_FOUND', `${config.label} non trouvé(e).`);
    return item;
  }

  return {
    list(req, res) {
      let result = items();
      Object.entries(filters).forEach(([param, rule]) => {
        const value = req.query[param];
        if (value === undefined || value === '') return;
        result = result.filter((item) => (typeof rule === 'function' ? rule(item, value) : item[rule] === value));
      });
      if (sort) result = [...result].sort(sort);

      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      res.json({
        data: result.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, total: result.length },
      });
    },

    getById(req, res) {
      res.json(find(req));
    },

    create(req, res) {
      const data = readBody(req);
      validate(data, { creating: true });

      const candidate = { id: newId(prefix) };
      [...fields, ...Object.keys(defaults).filter((k) => !fields.includes(k))].forEach((f) => {
        if (data[f] !== undefined) candidate[f] = data[f];
        else if (defaults[f] !== undefined) candidate[f] = typeof defaults[f] === 'function' ? defaults[f]() : defaults[f];
      });
      if (normalize) normalize(candidate, data);
      if (check) check(candidate, null);

      items().push(candidate);
      if (afterSave) afterSave(candidate, null);
      res.status(201).json(candidate);
    },

    update(req, res) {
      const existing = find(req);
      const data = readBody(req);
      validate(data, { creating: false });

      const previous = { ...existing };
      const candidate = { ...existing, ...data };
      if (normalize) normalize(candidate, data);
      if (check) check(candidate, existing);

      Object.assign(existing, candidate);
      if (afterSave) afterSave(existing, previous);
      res.json(existing);
    },

    remove(req, res) {
      const existing = find(req);
      if (canDelete) canDelete(existing);
      remove(existing);
      res.status(204).send();
    },
  };
}

module.exports = { createCrud, validators: v };
