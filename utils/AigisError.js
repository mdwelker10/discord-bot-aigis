class AigisError extends Error {
  constructor(message, status = 500) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = 'AigisError';
    this.status = status;
  }
}

module.exports = AigisError;