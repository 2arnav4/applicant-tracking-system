import { connection } from "next/server";
import { services } from "@/server/container";
import { parseBody, route } from "@/server/http/handler";
import { jobCreateSchema } from "@/shared/validation";

export const GET = route(async () => {
  // Always request-time: this reads live data and must never be prerendered at build.
  await connection();
  return Response.json(await services().jobs.list());
});

export const POST = route(async (request) => {
  const input = await parseBody(request, jobCreateSchema);
  return Response.json(await services().jobs.create(input), { status: 201 });
});
