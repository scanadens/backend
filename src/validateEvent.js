const { badRequest } = require('./errors');

// Checks an event create/update body and returns only the allowed, cleaned fields.
// partial = true for PATCH (fields are optional); false for create (title + starts_at required).
function validateEventFields(body, { partial }) {
  if (!body || typeof body !== 'object') throw badRequest('Request body must be a JSON object');
  const out = {};

  const text = (key, { required = false, max = 5000 } = {}) => {
    if (!(key in body)) {
      if (required && !partial) throw badRequest(`${key} is required`);
      return;
    }
    const v = body[key];
    if (v === null || v === '') {
      if (required) throw badRequest(`${key} cannot be empty`);
      out[key] = null;
      return;
    }
    if (typeof v !== 'string') throw badRequest(`${key} must be text`);
    if (v.length > max) throw badRequest(`${key} is too long (max ${max} characters)`);
    out[key] = v.trim();
  };

  const date = (key, { required = false } = {}) => {
    if (!(key in body)) {
      if (required && !partial) throw badRequest(`${key} is required`);
      return;
    }
    const v = body[key];
    if (v === null || v === '') {
      if (required) throw badRequest(`${key} cannot be empty`);
      out[key] = null;
      return;
    }
    if (typeof v !== 'string' || isNaN(Date.parse(v))) {
      throw badRequest(`${key} must be a date-time like 2026-12-01T18:00:00-05:00`);
    }
    out[key] = v;
  };

  text('title', { required: true, max: 200 });
  text('description');
  text('location', { max: 300 });
  text('registration_url', { max: 2000 });
  text('poster_url', { max: 2000 });
  date('starts_at', { required: true });
  date('ends_at');

  if ('price' in body) {
    const p = body.price === null || body.price === '' ? 0 : Number(body.price);
    if (!Number.isFinite(p) || p < 0) throw badRequest('price must be a number >= 0');
    out.price = Math.round(p * 100) / 100;
  }
  if ('category_id' in body) {
    const c = body.category_id;
    if (c === null || c === '') out.category_id = null;
    else if (!Number.isInteger(Number(c)) || Number(c) <= 0) throw badRequest('category_id must be a category id');
    else out.category_id = Number(c);
  }
  if (out.starts_at && out.ends_at && Date.parse(out.ends_at) <= Date.parse(out.starts_at)) {
    throw badRequest('ends_at must be after starts_at');
  }
  return out;
}

module.exports = { validateEventFields };
