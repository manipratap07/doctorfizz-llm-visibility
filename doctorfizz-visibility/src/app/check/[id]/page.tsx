import Tool from "@/components/Tool";
import { getToolConfig } from "@/lib/backend";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const config = await getToolConfig();
  return (
    <Tool
      providers={config.providers}
      initialCheckId={(await params).id}
      turnstileKey={config.turnstileKey}
    />
  );
}
