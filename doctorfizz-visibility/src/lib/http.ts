import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { sameOrigin } from "./identity";
export function error(e: unknown) {
  const message =
    e instanceof ZodError
      ? "Check the input fields."
      : e instanceof Error
        ? e.message
        : "Request could not be completed.";
  console.error(JSON.stringify({ event: "request_failed", message }));
  return NextResponse.json(
    { error: message },
    {
      status: /limit|allowance|budget|demand|Too many/.test(message)
        ? 429
        : 400,
    },
  );
}
export async function body(req: Request) {
  await sameOrigin();
  if (Number(req.headers.get("content-length") || 0) > 16384)
    throw new Error("Request too large.");
  const text = await req.text();
  if (text.length > 16384) throw new Error("Request too large.");
  return JSON.parse(text);
}
