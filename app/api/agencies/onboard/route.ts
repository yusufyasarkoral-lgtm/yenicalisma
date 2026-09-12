import { getChatGPTUser } from "@/app/chatgpt-auth";
import { sameOrigin } from "@/lib/document-storage";
import { database } from "@/lib/quotes-db";
import { AgencySessionError, requireAgencySession } from "@/lib/agency-session";

type OnboardBody = { agencyName: string };

function error(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function GET() {
  try {
    return Response.json(await requireAgencySession());
  } catch (caught) {
    if (caught instanceof AgencySessionError) return error(caught.code, caught.status);
    return error("session_error", 503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak", 403);
  const user = await getChatGPTUser();
  if (!user) return error("unauthenticated", 401);
  let body: OnboardBody | null = null;
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length === 1 &&
      typeof (parsed as Record<string, unknown>).agencyName === "string") {
      body = { agencyName: (parsed as Record<string, string>).agencyName };
    }
  } catch { /* validation below returns the public error */ }
  if (!body || !body.agencyName.trim() || body.agencyName.length > 160) {
    return error("Geçerli bir acente adı yazın.", 400);
  }

  const db = database();
  const existing = await db.prepare("SELECT id,agency_id,role FROM agency_users WHERE authenticated_user_id=?")
    .bind(user.userId).first<{ id: string; agency_id: string; role: string }>();
  if (existing) {
    return Response.json({
      authenticatedUserId: user.userId, agencyUserId: existing.id,
      agencyId: existing.agency_id, role: existing.role, existing: true,
    });
  }

  const now = new Date().toISOString();
  const agencyId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare("INSERT INTO agencies (id,name,created_at,updated_at) VALUES (?,?,?,?)")
        .bind(agencyId, body.agencyName.trim(), now, now),
      db.prepare("INSERT INTO agency_users (id,agency_id,authenticated_user_id,email,display_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,'owner','active',?,?)")
        .bind(memberId, agencyId, user.userId, user.email, user.displayName, now, now),
    ]);
    return Response.json({
      authenticatedUserId: user.userId, agencyUserId: memberId, agencyId, role: "owner",
    }, { status: 201 });
  } catch {
    const member = await db.prepare("SELECT id,agency_id,role FROM agency_users WHERE authenticated_user_id=?")
      .bind(user.userId).first<{ id: string; agency_id: string; role: string }>();
    if (member) {
      return Response.json({
        authenticatedUserId: user.userId, agencyUserId: member.id,
        agencyId: member.agency_id, role: member.role, existing: true,
      });
    }
    return error("Onboarding tamamlanamadı", 503);
  }
}
