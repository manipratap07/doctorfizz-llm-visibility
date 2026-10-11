export function track(
  event:
    | "site_analyzed"
    | "prompt_selected"
    | "check_started"
    | "check_completed"
    | "limit_reached"
    | "lead_submitted",
) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {});
}
