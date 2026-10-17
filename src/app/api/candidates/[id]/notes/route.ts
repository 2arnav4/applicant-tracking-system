import { services } from "@/server/container";
import { parseBody, parseId, route } from "@/server/http/handler";
import { idParamSchema, noteCreateSchema } from "@/shared/validation";

type Ctx = RouteContext<"/api/candidates/[id]/notes">;

export const POST = route<Ctx>(async (request, { params }) => {
  const id = parseId((await params).id, idParamSchema);
  const { body } = await parseBody(request, noteCreateSchema);
  return Response.json(await services().candidates.addNote(id, body), { status: 201 });
});
