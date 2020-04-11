/**
 * Model not found error.
 */
class ModelNotFoundError extends Error {
  constructor(m: string) {
    super(m);

    this.name = 'ModelNotFoundError';
    Object.setPrototypeOf(this, ModelNotFoundError.prototype);
  }
}

export default ModelNotFoundError;
