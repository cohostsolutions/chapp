/**
 * Unit tests for _shared/ai-request-validation.ts
 *
 * Run with:
 * deno test --allow-env supabase/functions/_tests/ai-request-validation.test.ts
 */

import {
  assertEquals,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

import {
  isUuid,
  normalizeKnowledgeBase,
  normalizeLeadName,
  normalizeMessage,
  normalizeTranscriptMessages,
  validateEvaluateSessionInput,
  MAX_DEMO_KNOWLEDGE_BASE_LENGTH,
  MAX_DEMO_MESSAGE_LENGTH,
} from "../_shared/ai-request-validation.ts";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";

Deno.test("isUuid validates canonical UUIDs", () => {
  assertEquals(isUuid(validUuid), true);
  assertEquals(isUuid("not-a-uuid"), false);
});

Deno.test("normalizeLeadName trims and bounds", () => {
  assertEquals(normalizeLeadName("  Jane Doe  "), "Jane Doe");
  assertEquals(normalizeLeadName(""), null);
  assertEquals(normalizeLeadName(42), null);
});

Deno.test("normalizeMessage enforces non-empty and max length", () => {
  assertEquals(normalizeMessage("  hello  ", MAX_DEMO_MESSAGE_LENGTH), "hello");
  assertEquals(normalizeMessage("", MAX_DEMO_MESSAGE_LENGTH), null);
  assertEquals(normalizeMessage("x".repeat(MAX_DEMO_MESSAGE_LENGTH + 1), MAX_DEMO_MESSAGE_LENGTH), null);
});

Deno.test("normalizeKnowledgeBase clips long payloads", () => {
  const clipped = normalizeKnowledgeBase("x".repeat(MAX_DEMO_KNOWLEDGE_BASE_LENGTH + 500));
  assertEquals(clipped.length, MAX_DEMO_KNOWLEDGE_BASE_LENGTH);
  assertEquals(normalizeKnowledgeBase(123), "");
});

Deno.test("normalizeTranscriptMessages keeps valid roles and clips content", () => {
  const normalized = normalizeTranscriptMessages([
    { role: "user", content: "hello" },
    { role: "assistant", content: "world" },
    { role: "system", content: "skip me" },
    { role: "user", content: 123 },
  ]);

  assertEquals(normalized.length, 2);
  assertEquals(normalized[0].role, "user");
  assertEquals(normalized[1].role, "assistant");
});

Deno.test("validateEvaluateSessionInput accepts valid payload", () => {
  const result = validateEvaluateSessionInput({
    moduleId: validUuid,
    sessionId: validUuid,
    organizationId: validUuid,
    transcript: [{ role: "user", content: "Hi" }],
  });

  assertEquals(result.ok, true);
  assertEquals(Array.isArray(result.normalizedTranscript), true);
  assertEquals(result.normalizedTranscript?.length, 1);
});

Deno.test("validateEvaluateSessionInput rejects invalid payload", () => {
  const badModule = validateEvaluateSessionInput({
    moduleId: "bad",
    organizationId: validUuid,
    transcript: [{ role: "user", content: "Hi" }],
  });
  assertEquals(badModule.ok, false);

  const badTranscript = validateEvaluateSessionInput({
    moduleId: validUuid,
    organizationId: validUuid,
    transcript: [{ role: "system", content: "ignored" }],
  });
  assertEquals(badTranscript.ok, false);
});
