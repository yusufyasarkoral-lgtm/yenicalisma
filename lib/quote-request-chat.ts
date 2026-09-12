import { branchDefinitions, getBranch, type FieldDefinition } from "./quote-intake-schema.ts";

export type CollectedValue = {
  value: string | number | boolean | "unknown";
  confidence: number;
  source: "user_message";
  updatedAt: string;
};

export type AssistantExtraction = {
  key: string;
  value: string | number | boolean | "unknown";
  confidence: number;
};

export type AssistantReply = {
  detectedBranch: string | null;
  branchConfidence: number;
  extractedFields: AssistantExtraction[];
};

const isValue = (value: unknown): value is AssistantExtraction["value"] =>
  typeof value === "string" || typeof value === "number" ||
  typeof value === "boolean";

export function parseAssistantReply(value: unknown): AssistantReply | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const detectedBranch = row.detected_branch;
  const branchConfidence = row.branch_confidence;
  const extractedFields = row.extracted_fields;
  if (detectedBranch !== null && typeof detectedBranch !== "string") return null;
  if (typeof branchConfidence !== "number" || !Number.isFinite(branchConfidence)) return null;
  if (!Array.isArray(extractedFields)) return null;

  const normalized = extractedFields.flatMap((field): AssistantExtraction[] => {
    if (!field || typeof field !== "object") return [];
    const candidate = field as Record<string, unknown>;
    if (typeof candidate.key !== "string" || candidate.key.length > 80 ||
      !isValue(candidate.value) || typeof candidate.confidence !== "number" ||
      !Number.isFinite(candidate.confidence)) return [];
    if (typeof candidate.value === "string" && candidate.value.length > 500) return [];
    return [{
      key: candidate.key,
      value: candidate.value === "unknown" ? "unknown" : candidate.value,
      confidence: Math.max(0, Math.min(1, candidate.confidence)),
    }];
  });

  return {
    detectedBranch: detectedBranch?.trim() || null,
    branchConfidence: Math.max(0, Math.min(1, branchConfidence)),
    extractedFields: normalized,
  };
}

export function isConfirmation(message: string) {
  return /^(evet|onay|onaylıyorum|onayliyorum|gönder|gonder|doğru|dogru)\b/i.test(message.trim());
}

export function nextQuestion(branchKey: string, missing: { required: string[]; recommended: string[] }) {
  const branch = getBranch(branchKey);
  if (!branch) return "Hangi risk için teklif istiyorsunuz? Yangın/işyeri, kasko, trafik veya sağlık olabilir.";
  const labels = (keys: string[]) => keys.slice(0, 2)
    .map((key) => branch.fields.find((field) => field.key === key)?.label)
    .filter((label): label is string => Boolean(label))
    .join(" ve ");
  if (missing.required.length) return `Devam edebilmem için ${labels(missing.required)} bilgisini paylaşabilir misiniz?`;
  if (missing.recommended.length) return `Teklif özetini güçlendirmek için ${labels(missing.recommended)} bilgisini de paylaşabilirsiniz.`;
  return "Zorunlu bilgiler tamam. Aşağıdaki özeti kontrol edebilir, gerekirse bir bilgiyi düzeltebilirsiniz.";
}

export function requestSummary(branchKey: string, fields: Record<string, CollectedValue>) {
  const branch = getBranch(branchKey);
  if (!branch) return "";
  return branch.fields
    .filter((field: FieldDefinition) => fields[field.key])
    .map((field: FieldDefinition) => `${field.label}: ${fields[field.key].value === "unknown" ? "Bilinmiyor" : fields[field.key].value}`)
    .join("\n");
}

export const assistantResponseSchema = {
  type: "OBJECT",
  properties: {
    detected_branch: { type: "STRING", nullable: true },
    branch_confidence: { type: "NUMBER" },
    extracted_fields: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING" },
          value: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["key", "value", "confidence"],
      },
    },
  },
  required: ["detected_branch", "branch_confidence", "extracted_fields"],
} as const;

export const branchCatalog = branchDefinitions.map((branch) => ({
  key: branch.key,
  label: branch.label,
  aliases: branch.aliases,
  fields: branch.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
  })),
}));
