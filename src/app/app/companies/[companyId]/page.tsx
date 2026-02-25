import { redirect } from "next/navigation";

/**
 * Redirect legacy route:
 * /app/companies/[companyId] -> /app/company/[companyId]
 *
 * Next.js 16 PageProps expects params as a Promise, so we await it.
 */
export default async function CompaniesRedirect({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  redirect(`/app/company/${encodeURIComponent(companyId)}`);
}
