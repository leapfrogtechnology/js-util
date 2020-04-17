/**
 * Row not found error.
 */
class RowNotFoundError extends Error {
  constructor(m: string) {
    super(m);

    this.name = 'RowNotFoundError';
    Object.setPrototypeOf(this, RowNotFoundError.prototype);
  }
}

export default RowNotFoundError;
