import { redirect } from "next/navigation";

/**
 * Redirect legacy route:
 * /app/companies/[companyId]/workers/[rut] -> /app/company/[companyId]/workers/[rut]
 *
 * Next.js 16 PageProps expects params as a Promise, so we await it.
 */
export default async function CompaniesWorkerRedirect({
  params,
}: {
  params: Promise<{ companyId: string; rut: string }>;
}) {
  const { companyId, rut } = await params;

  redirect(
    `/app/company/${encodeURIComponent(companyId)}/workers/${encodeURIComponent(rut)}`
  );
}
