import { getToolConfig, relay } from "@/lib/backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(req: Request) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  return Response.json(await getToolConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
