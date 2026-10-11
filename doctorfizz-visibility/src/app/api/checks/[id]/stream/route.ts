export const maxDuration = 180;
import { relay } from "@/lib/backend";
import { getCheck } from "@/lib/checks";
import { rateLimit } from "@/lib/limits";
import { error } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const forwarded = await relay(req);
  if (forwarded) return forwarded;
  try {
    await rateLimit("stream", 15);
    const { id } = await params;
    const initial = await getCheck(id);
    if (!initial) return new Response("Check not found", { status: 404 });
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) =>
          controller.enqueue(
            encoder.encode(
              "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n",
            ),
          );
        const tick = async () => {
          if (closed) return;
          try {
            const c = await getCheck(id);
            if (!c) {
              controller.close();
              closed = true;
              return;
            }
            send(
              c.status === "completed" ? "check.completed" : "run.updated",
              c,
            );
            if (c.status === "completed") {
              closed = true;
              controller.close();
              return;
            }
            timer = setTimeout(tick, 1500);
          } catch {
            closed = true;
            controller.close();
          }
        };
        req.signal.addEventListener("abort", () => {
          closed = true;
          clearTimeout(timer);
          try {
            controller.close();
          } catch {}
        });
        send("run.updated", initial);
        timer = setTimeout(tick, 1000);
      },
      cancel() {
        closed = true;
        clearTimeout(timer);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return error(e);
  }
}
