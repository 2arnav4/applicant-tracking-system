import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, BadRequestError } from "@/server/domain/errors";

export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return Response.json(body, { status });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid request", z.flattenError(error));
  }
  if (error instanceof AppError) {
    return errorResponse(error.status, error.code, error.message, error.details);
  }
  // Unknown errors: log server-side, never leak internals to the client.
  console.error("[api] unhandled error", error);
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong");
}

/** Wraps a route handler so every thrown error becomes a consistent JSON error response. */
export function route<Ctx>(handler: (request: NextRequest, context: Ctx) => Promise<Response>) {
  return async (request: NextRequest, context: Ctx): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Let Next's own control-flow signals (prerender bail-out, redirects) pass through.
      unstable_rethrow(error);
      return toErrorResponse(error);
    }
  };
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
  return schema.parse(body);
}

export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.output<S> {
  const params: Record<string, string> = {};
  // Empty params (e.g. `?stage=`) mean "no filter", not an invalid value.
  request.nextUrl.searchParams.forEach((value, key) => {
    if (value !== "") params[key] = value;
  });
  return schema.parse(params);
}

export function parseId(raw: string, schema: z.ZodType<string>): string {
  const result = schema.safeParse(raw);
  if (!result.success) throw new BadRequestError("Invalid id");
  return result.data;
}
