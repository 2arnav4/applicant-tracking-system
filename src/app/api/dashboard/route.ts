import { connection } from "next/server";
import { services } from "@/server/container";
import { route } from "@/server/http/handler";

export const GET = route(async () => {
  await connection();
  return Response.json(await services().dashboard.getMetrics());
});
