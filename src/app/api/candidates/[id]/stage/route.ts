import { services } from "@/server/container";
import { parseBody, parseId, route } from "@/server/http/handler";
import { idParamSchema, stageChangeSchema } from "@/shared/validation";

type Ctx = RouteContext<"/api/candidates/[id]/stage">;

export const PATCH = route<Ctx>(async (request, { params }) => {
  const id = parseId((await params).id, idParamSchema);
  const change = await parseBody(request, stageChangeSchema);
  return Response.json(await services().candidates.changeStage(id, change));
});
