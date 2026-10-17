import { services } from "@/server/container";
import { parseBody, parseQuery, route } from "@/server/http/handler";
import { candidateCreateSchema, candidateListQuerySchema } from "@/shared/validation";

export const GET = route(async (request) => {
  const query = parseQuery(request, candidateListQuerySchema);
  return Response.json(await services().candidates.list(query));
});

export const POST = route(async (request) => {
  const input = await parseBody(request, candidateCreateSchema);
  return Response.json(await services().candidates.create(input), { status: 201 });
});
