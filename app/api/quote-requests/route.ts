import { env } from "cloudflare:workers";

import { database } from "@/lib/quotes-db";
import { sameOrigin } from "@/lib/document-storage";
import { getBranch, missingFields } from "@/lib/quote-intake-schema";
import {
  assistantResponseSchema,
  branchCatalog,
  isConfirmation,
  nextQuestion,
  parseAssistantReply,
  requestSummary,
  type CollectedValue,
} from "@/lib/quote-request-chat";
import { AgencySessionError, requireAgencySession } from "@/lib/agency-session";

type RequestRow = {
  id: string; agency: string; agency_id: string; branch_key: string; branch_label: string;
  branch_confidence: number; status: string; collected_fields: string;
  missing_required_fields: string; missing_recommended_fields: string; ai_summary: string;
};
type StoredMessage = { role: string; content: string; created_at: string };
type Missing = { required: string[]; recommended: string[] };

const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);

function jsonValue<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function validMissing(value: unknown): Missing {
  if (!value || typeof value !== "object") return { required: [], recommended: [] };
  const candidate = value as Record<string, unknown>;
  const keys = (key: string) => Array.isArray(candidate[key])
    ? candidate[key].filter((item): item is string => typeof item === "string") : [];
  return { required: keys("required"), recommended: keys("recommended") };
}

function validFields(value: unknown): Record<string, CollectedValue> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, field]) => {
    if (!field || typeof field !== "object") return [];
    const candidate = field as Record<string, unknown>;
    const raw = candidate.value;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") return [];
    if (typeof raw === "string" && raw.length > 500) return [];
    return [[key, {
      value: raw === "unknown" ? "unknown" : raw,
      confidence: typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence)) : 0,
      source: "user_message" as const,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
    }]];
  }));
}

async function requestRow(id: string, agencyId: string) {
  return database().prepare("SELECT * FROM quote_requests WHERE id=? AND agency_id=?")
    .bind(id, agencyId).first<RequestRow>();
}

async function session() {
  try { return await requireAgencySession(); } catch (error) {
    if (error instanceof AgencySessionError) throw Response.json({ error: error.code }, { status: error.status });
    throw error;
  }
}

const errorResponse = (error: string, status = 400) => Response.json({ error }, { status });

export async function GET(request: Request) {
  try {
    const activeSession = await session();
    const id = new URL(request.url).searchParams.get("id");
    if (!validId(id)) return errorResponse("Geçersiz talep");
    const requestData = await requestRow(id, activeSession.agencyId);
    if (!requestData) return errorResponse("Talep bulunamadı", 404);
    const messages = await database().prepare(
      "SELECT role,content,created_at FROM quote_request_messages WHERE request_id=? ORDER BY created_at ASC, id ASC",
    ).bind(id).all<StoredMessage>();
    return Response.json({
      ...requestData,
      fields: validFields(jsonValue(requestData.collected_fields, {})),
      missing: validMissing({
        required: jsonValue(requestData.missing_required_fields, []),
        recommended: jsonValue(requestData.missing_recommended_fields, []),
      }),
      messages: messages.results,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Quote request load failed", error);
    return errorResponse("Talep yüklenemedi. Yeniden deneyin.", 503);
  }
}

export async function POST(request: Request) {
  try {
    const activeSession = await session();
    if (!sameOrigin(request)) return errorResponse("Geçersiz kaynak", 403);
    const db = database();
    const agency = await db.prepare("SELECT name FROM agencies WHERE id=?")
      .bind(activeSession.agencyId).first<{ name: string }>();
    if (!agency) return errorResponse("Acente bulunamadı", 404);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const greeting = "Merhaba. Teklif talebinizi kısaca anlatabilirsiniz; gerekli bilgileri konuşarak tamamlayalım.";
    await db.batch([
      db.prepare("INSERT INTO quote_requests (id,agency,agency_id,created_by_user_id,branch_key,branch_label,branch_confidence,status,collected_fields,missing_required_fields,missing_recommended_fields,ai_summary,confirmation_requested,confirmed_at,quote_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id, agency.name, activeSession.agencyId, activeSession.agencyUserId, "", "", 0, "collecting_information", "{}", "[]", "[]", "", 0, "", "", now, now),
      db.prepare("INSERT INTO quote_request_messages (id,request_id,role,content,extracted_fields,created_at) VALUES (?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), id, "assistant", greeting, "[]", now),
    ]);
    return Response.json({ id, assistantMessage: greeting }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Quote request create failed", error);
    return errorResponse("Teklif talebi oluşturulamadı.", 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const activeSession = await session();
    if (!sameOrigin(request)) return errorResponse("Geçersiz kaynak", 403);
    const raw = await request.text();
    if (raw.length > 4_000) return errorResponse("Geçersiz mesaj");
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object") return errorResponse("Geçersiz mesaj");
    const candidate = body as Record<string, unknown>;
    if (!validId(candidate.id) || typeof candidate.message !== "string" ||
      !candidate.message.trim() || candidate.message.length > 3_000) return errorResponse("Geçersiz mesaj");
    const message = candidate.message.trim();
    const requestData = await requestRow(candidate.id, activeSession.agencyId);
    if (!requestData) return errorResponse("Talep bulunamadı", 404);
    const db = database();
    const fields = validFields(jsonValue(requestData.collected_fields, {}));
    const previousMissing = validMissing({
      required: jsonValue(requestData.missing_required_fields, []),
      recommended: jsonValue(requestData.missing_recommended_fields, []),
    });
    const previous = await db.prepare("SELECT content FROM quote_request_messages WHERE request_id=? AND role='user' ORDER BY created_at DESC LIMIT 1")
      .bind(requestData.id).first<{ content: string }>();
    if (previous?.content === message) {
      return Response.json({ duplicate: true, status: requestData.status, fields, missing: previousMissing, assistantMessage: requestData.ai_summary });
    }
    if (requestData.status === "ready_for_review" && isConfirmation(message)) {
      const assistantMessage = "Özet hazır. Broker’a iletme adımı henüz etkin değil; isterseniz herhangi bir bilgiyi düzeltebilirsiniz.";
      const now = new Date().toISOString();
      await db.batch([
        db.prepare("INSERT INTO quote_request_messages (id,request_id,role,content,extracted_fields,created_at) VALUES (?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), requestData.id, "user", message, "[]", now),
        db.prepare("INSERT INTO quote_request_messages (id,request_id,role,content,extracted_fields,created_at) VALUES (?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), requestData.id, "assistant", assistantMessage, "[]", now),
      ]);
      return Response.json({ status: "ready_for_review", fields, missing: previousMissing, assistantMessage });
    }
    const apiKey = (env as Cloudflare.Env).GEMINI_API_KEY;
    if (!apiKey) return errorResponse("Yapay zekâ asistanı bağlı değil", 503);
    const prompt = `Türkiye sigorta teklif talebi asistanısın. Bilgi uydurma; bilinmeyen değer için unknown kullan; düzeltmede yeni değeri çıkar. Branş kesin değilse null. Sayısal ve tarih değerlerini metin olarak döndür. Şema:${JSON.stringify(branchCatalog)} Mevcut branş:${requestData.branch_key || "yok"} alanlar:${JSON.stringify(fields)} mesaj:${message}`;
    const modelResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: assistantResponseSchema },
      }),
    });
    if (!modelResponse.ok) {
      console.error("Quote assistant model failed", modelResponse.status);
      return errorResponse("Asistan şu an yanıt veremiyor", 503);
    }
    const payload: unknown = await modelResponse.json();
    const modelText = (payload && typeof payload === "object")
      ? (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text
      : undefined;
    let modelData: unknown;
    try { modelData = typeof modelText === "string" ? JSON.parse(modelText) : null; } catch { modelData = null; }
    const reply = parseAssistantReply(modelData);
    if (!reply) return errorResponse("Asistandan geçerli bir yanıt alınamadı", 503);
    const branch = getBranch(reply.detectedBranch || requestData.branch_key);
    const accepted = reply.extractedFields.filter((field) =>
      branch?.fields.some((definition) => definition.key === field.key) && field.confidence >= 0.6,
    );
    const now = new Date().toISOString();
    const auditStatements = accepted.flatMap((field) => {
      const previousValue = fields[field.key];
      fields[field.key] = { value: field.value, confidence: field.confidence, source: "user_message", updatedAt: now };
      return previousValue && String(previousValue.value) !== String(field.value)
        ? [db.prepare("INSERT INTO quote_request_audit (id,request_id,field_key,old_value,new_value,source,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), requestData.id, field.key, String(previousValue.value), String(field.value), "user_message", now)]
        : [];
    });
    const plainFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.value]));
    const missing = branch ? missingFields(branch.key, plainFields) : { required: [], recommended: [] };
    const ready = Boolean(branch) && !missing.required.length;
    const status = ready ? "ready_for_review" : "collecting_information";
    const summary = ready ? requestSummary(branch!.key, fields) : "";
    const assistantMessage = ready
      ? `${summary}\n\n${nextQuestion(branch!.key, missing)}`
      : nextQuestion(branch?.key || "", missing);
    await db.batch([
      ...auditStatements,
      db.prepare("INSERT INTO quote_request_messages (id,request_id,role,content,extracted_fields,created_at) VALUES (?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), requestData.id, "user", message, JSON.stringify(accepted), now),
      db.prepare("INSERT INTO quote_request_messages (id,request_id,role,content,extracted_fields,created_at) VALUES (?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), requestData.id, "assistant", assistantMessage, "[]", now),
      db.prepare("UPDATE quote_requests SET branch_key=?,branch_label=?,branch_confidence=?,status=?,collected_fields=?,missing_required_fields=?,missing_recommended_fields=?,ai_summary=?,confirmation_requested=?,updated_at=? WHERE id=? AND agency_id=?")
        .bind(branch?.key || "", branch?.label || "", branch ? reply.branchConfidence : 0, status, JSON.stringify(fields), JSON.stringify(missing.required), JSON.stringify(missing.recommended), summary, 0, now, requestData.id, activeSession.agencyId),
    ]);
    return Response.json({ status, branch: branch && { key: branch.key, label: branch.label }, fields, missing, summary, assistantMessage });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Quote assistant failed", error);
    return errorResponse("Asistan şu an yanıt veremiyor", 503);
  }
}
