import { services } from "@/server/container";
import { parseBody, parseId, route } from "@/server/http/handler";
import { candidateUpdateSchema, idParamSchema } from "@/shared/validation";

type Ctx = RouteContext<"/api/candidates/[id]">;

export const GET = route<Ctx>(async (_request, { params }) => {
  const id = parseId((await params).id, idParamSchema);
  return Response.json(await services().candidates.getById(id));
});

export const PATCH = route<Ctx>(async (request, { params }) => {
  const id = parseId((await params).id, idParamSchema);
  const input = await parseBody(request, candidateUpdateSchema);
  return Response.json(await services().candidates.update(id, input));
});

export const DELETE = route<Ctx>(async (_request, { params }) => {
  const id = parseId((await params).id, idParamSchema);
  await services().candidates.remove(id);
  return new Response(null, { status: 204 });
});
