import { NextRequest } from "next/server";
import { POST as CHECKIN_POST } from "@/app/api/public/checkin/route";

export const dynamic = "force-dynamic";

/**
 * Alias backwards-compat:
 * POST /api/public/attend -> /api/public/checkin
 */
export async function POST(req: NextRequest) {
  return CHECKIN_POST(req);
}
