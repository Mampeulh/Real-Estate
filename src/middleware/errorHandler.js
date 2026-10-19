class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ code: err.code, message: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'INVALID_JSON', message: 'Corps de requête JSON invalide.' });
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route non trouvée.' });
}

module.exports = { ApiError, errorHandler, notFoundHandler };
