import { CampaignPersonView } from "@/components/kampanjer/CampaignPersonView";

export default async function CampaignPersonPage({
  params,
}: {
  params: Promise<{ cid: string; pid: string }>;
}) {
  const { cid, pid } = await params;
  return <CampaignPersonView campaignId={cid} personId={pid} />;
}
