import assert from "node:assert/strict";
import test from "node:test";

import { isConfirmation, nextQuestion, parseAssistantReply, requestSummary } from "../../lib/quote-request-chat.ts";

test("model yanıtını doğrular ve güven aralığını sınırlar", () => {
  assert.deepEqual(parseAssistantReply({
    detected_branch: "kasko",
    branch_confidence: 1.2,
    extracted_fields: [{ key: "plate", value: "34 ABC 123", confidence: -1 }],
  }), {
    detectedBranch: "kasko",
    branchConfidence: 1,
    extractedFields: [{ key: "plate", value: "34 ABC 123", confidence: 0 }],
  });
  assert.equal(parseAssistantReply({ extracted_fields: [] }), null);
});

test("tamamlanan kasko talebi için gönderim yerine özet yönlendirmesi yapar", () => {
  const fields = {
    insured_name: { value: "Sentetik Kullanıcı", confidence: 1, source: "user_message" as const, updatedAt: "2026-01-01" },
    plate: { value: "34 ABC 123", confidence: 1, source: "user_message" as const, updatedAt: "2026-01-01" },
  };
  assert.match(nextQuestion("kasko", { required: [], recommended: ["vehicle_make_model"] }), /özetini güçlendirmek/i);
  assert.match(requestSummary("kasko", fields), /34 ABC 123/);
  assert.equal(isConfirmation("onaylıyorum"), true);
});
