import { services } from "@/server/container";
import { parseQuery, route } from "@/server/http/handler";
import { pipelineQuerySchema } from "@/shared/validation";

export const GET = route(async (request) => {
  const query = parseQuery(request, pipelineQuerySchema);
  return Response.json(await services().candidates.pipeline(query));
});
