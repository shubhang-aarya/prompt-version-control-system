export function makeHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;

  if (details) {
    error.details = details;
  }

  return error;
}

export function validate(schema, payload, message) {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw makeHttpError(400, message, parsed.error.issues);
  }

  return parsed.data;
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
