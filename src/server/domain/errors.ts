/**
 * Typed application errors. Services throw these; the HTTP layer maps them
 * to status codes, so business code never deals with Response objects.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(404, "NOT_FOUND", `${entity} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

/** Valid input that breaks a business rule (e.g. an illegal stage transition). */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(422, "BUSINESS_RULE_VIOLATION", message);
  }
}

/** Postgres SQLSTATE 23505. Drizzle wraps driver errors, so check the cause too. */
export function isUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code === "23505" || err?.cause?.code === "23505";
}
