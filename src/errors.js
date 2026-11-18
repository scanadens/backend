class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (msg) => new HttpError(400, 'VALIDATION_ERROR', msg);
const unauthenticated = (msg = 'Please log in') => new HttpError(401, 'UNAUTHENTICATED', msg);
const forbidden = (msg = 'You are not allowed to do this') => new HttpError(403, 'FORBIDDEN', msg);
const notFound = (msg = 'Not found') => new HttpError(404, 'NOT_FOUND', msg);
const conflict = (msg) => new HttpError(409, 'CONFLICT', msg);

// Express error handler: every error leaves the API in the same shape
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // Bad JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' } });
  }
  // Postgres errors that are really the client's fault
  const pgMap = {
    '22P02': [400, 'VALIDATION_ERROR', 'Invalid value in request'],
    '22007': [400, 'VALIDATION_ERROR', 'Invalid date'],
    '22008': [400, 'VALIDATION_ERROR', 'Invalid date'],
    '23503': [400, 'VALIDATION_ERROR', 'Referenced item does not exist (check category_id)'],
    '23505': [409, 'CONFLICT', 'Already exists'],
    '23514': [400, 'VALIDATION_ERROR', 'Invalid value (check dates: ends_at must be after starts_at; price must be >= 0)'],
  };
  if (pgMap[err.code]) {
    const [status, code, message] = pgMap[err.code];
    return res.status(status).json({ error: { code, message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
}

module.exports = { HttpError, badRequest, unauthenticated, forbidden, notFound, conflict, errorHandler };
