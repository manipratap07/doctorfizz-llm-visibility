import StructuredData from "@/components/StructuredData";
import Tool from "@/components/Tool";
import { getToolConfig } from "@/lib/backend";
export const dynamic = "force-dynamic";
export default async function Page() {
  const config = await getToolConfig();
  return (
    <>
      <StructuredData />
      <Tool providers={config.providers} turnstileKey={config.turnstileKey} />
    </>
  );
}
