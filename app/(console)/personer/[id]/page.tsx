"use client";

import { useParams } from "next/navigation";
import { DossierFull } from "@/components/personer/DossierFull";

export default function PersonPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  return <DossierFull personId={id} />;
}
