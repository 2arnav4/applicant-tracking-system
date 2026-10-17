import { services } from "@/server/container";
import { parseBody, parseId, route } from "@/server/http/handler";
import { idParamSchema, jobUpdateSchema } from "@/shared/validation";

type Ctx = RouteContext<"/api/jobs/[id]">;

export const GET = route<Ctx>(async (_request, { params }) => {
  const id = parseId((await params).id, idParamSchema);
  return Response.json(await services().jobs.getById(id));
});

export const PATCH = route<Ctx>(async (request, { params }) => {
  const id = parseId((await params).id, idParamSchema);
  const input = await parseBody(request, jobUpdateSchema);
  return Response.json(await services().jobs.update(id, input));
});

export const DELETE = route<Ctx>(async (_request, { params }) => {
  const id = parseId((await params).id, idParamSchema);
  await services().jobs.remove(id);
  return new Response(null, { status: 204 });
});
