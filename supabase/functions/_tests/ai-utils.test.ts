/**
 * Unit tests for _shared/ai-utils.ts
 * 
 * Run with: deno test --allow-env supabase/functions/_tests/ai-utils.test.ts
 */

import {
  assertEquals,
  assertStringIncludes,
  assertNotEquals,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

import {
  getLanguageName,
  buildLanguageInstructions,
  getDateContext,
  conversationInstructions,
  imageInstructions,
  agentConfigs,
  agentTemperatures,
  buildSystemPrompt,
  getAgentTemperature,
  isExemptOrganization,
  type AgentType,
} from "../_shared/ai-utils.ts";

// ============= getLanguageName Tests =============

Deno.test("getLanguageName - returns full name for known language codes", () => {
  assertEquals(getLanguageName("en"), "English");
  assertEquals(getLanguageName("es"), "Spanish");
  assertEquals(getLanguageName("tl"), "Tagalog");
  assertEquals(getLanguageName("ceb"), "Cebuano");
  assertEquals(getLanguageName("zh"), "Chinese (Mandarin)");
  assertEquals(getLanguageName("ja"), "Japanese");
});

Deno.test("getLanguageName - returns code for unknown languages", () => {
  assertEquals(getLanguageName("xyz"), "xyz");
  assertEquals(getLanguageName("unknown"), "unknown");
});

Deno.test("getLanguageName - handles custom language prefix", () => {
  assertEquals(getLanguageName("custom:esperanto"), "Esperanto");
  assertEquals(getLanguageName("custom:klingon"), "Klingon");
});

// ============= buildLanguageInstructions Tests =============

Deno.test("buildLanguageInstructions - exempt org gets unrestricted instructions", () => {
  const result = buildLanguageInstructions(["en"], true, true);
  assertStringIncludes(result, "Automatically detect the language");
  assertStringIncludes(result, "NOT restricted");
});

Deno.test("buildLanguageInstructions - language lock disabled gets unrestricted", () => {
  const result = buildLanguageInstructions(["en", "es"], false, false);
  assertStringIncludes(result, "Automatically detect the language");
});

Deno.test("buildLanguageInstructions - language lock enabled restricts languages", () => {
  const result = buildLanguageInstructions(["en", "tl"], true, false);
  assertStringIncludes(result, "ONLY allowed to respond in these languages");
  assertStringIncludes(result, "English");
  assertStringIncludes(result, "Tagalog");
});

Deno.test("buildLanguageInstructions - sets primary language from first in list", () => {
  const result = buildLanguageInstructions(["tl", "en"], true, false);
  assertStringIncludes(result, "primary language is: Tagalog");
});

// ============= getDateContext Tests =============

Deno.test("getDateContext - includes today's date", () => {
  const result = getDateContext();
  assertStringIncludes(result, "Today is:");
  assertStringIncludes(result, "CRITICAL - CURRENT DATE AWARENESS");
});

Deno.test("getDateContext - includes tomorrow", () => {
  const result = getDateContext();
  assertStringIncludes(result, "Tomorrow is:");
});

Deno.test("getDateContext - includes weekend dates", () => {
  const result = getDateContext();
  assertStringIncludes(result, "This Saturday is:");
  assertStringIncludes(result, "This Sunday is:");
});

Deno.test("getDateContext - includes next Monday", () => {
  const result = getDateContext();
  assertStringIncludes(result, "Next Monday is:");
});

Deno.test("getDateContext - includes relative date interpretation guide", () => {
  const result = getDateContext();
  assertStringIncludes(result, "RELATIVE DATE INTERPRETATION");
  assertStringIncludes(result, '"today"');
  assertStringIncludes(result, '"tomorrow"');
  assertStringIncludes(result, '"this Sunday"');
  assertStringIncludes(result, '"this weekend"');
});

Deno.test("getDateContext - emphasizes accepting relative dates", () => {
  const result = getDateContext();
  assertStringIncludes(result, "VALID check-in/check-out answers");
  assertStringIncludes(result, "ALWAYS state the explicit dates");
});

Deno.test("getDateContext - respects timezone parameter", () => {
  // Both should work without errors
  const manila = getDateContext("Asia/Manila");
  const utc = getDateContext("UTC");
  
  // Both should contain date info
  assertStringIncludes(manila, "Today is:");
  assertStringIncludes(utc, "Today is:");
});

// ============= conversationInstructions Tests =============

Deno.test("conversationInstructions - includes key directives", () => {
  assertStringIncludes(conversationInstructions, "FULL conversation history");
  assertStringIncludes(conversationInstructions, "NEVER repeat information");
  assertStringIncludes(conversationInstructions, "NEVER ask questions you've already asked");
});

// ============= imageInstructions Tests =============

Deno.test("imageInstructions - includes sharing and analysis guidance", () => {
  assertStringIncludes(imageInstructions, "IMAGE SHARING INSTRUCTIONS");
  assertStringIncludes(imageInstructions, "IMAGE ANALYSIS INSTRUCTIONS");
  assertStringIncludes(imageInstructions, "[IMAGE: url]");
});

// ============= agentConfigs Tests =============

Deno.test("agentConfigs - contains all three agents", () => {
  assertEquals(Object.keys(agentConfigs).sort(), ["cece", "jay", "may"]);
});

Deno.test("agentConfigs - jay has correct properties", () => {
  assertEquals(agentConfigs.jay.name, "Jay");
  assertEquals(agentConfigs.jay.title, "Sales Assistant");
  assertStringIncludes(agentConfigs.jay.systemPrompt, "sales assistant");
});

Deno.test("agentConfigs - may has correct properties", () => {
  assertEquals(agentConfigs.may.name, "May");
  assertEquals(agentConfigs.may.title, "Restaurant Assistant");
  assertStringIncludes(agentConfigs.may.systemPrompt, "restaurant");
});

Deno.test("agentConfigs - cece has correct properties", () => {
  assertEquals(agentConfigs.cece.name, "Cece");
  assertEquals(agentConfigs.cece.title, "Resort Concierge");
  assertStringIncludes(agentConfigs.cece.systemPrompt, "concierge");
});

Deno.test("agentConfigs - cece includes enhanced date handling guardrails", () => {
  assertStringIncludes(agentConfigs.cece.systemPrompt, "CRITICAL - DATE HANDLING");
  assertStringIncludes(agentConfigs.cece.systemPrompt, "RELATIVE DATES ARE VALID");
  assertStringIncludes(agentConfigs.cece.systemPrompt, "SINGLE DATE = ASK FOR CHECK-OUT");
  assertStringIncludes(agentConfigs.cece.systemPrompt, "ALWAYS CONFIRM WITH EXPLICIT DATES");
});

// ============= agentTemperatures Tests =============

Deno.test("agentTemperatures - contains tuned values for each agent", () => {
  assertEquals(agentTemperatures.jay, 0.7);
  assertEquals(agentTemperatures.may, 0.3);
  assertEquals(agentTemperatures.cece, 0.5);
});

Deno.test("getAgentTemperature - returns shared temperature for known agents", () => {
  assertEquals(getAgentTemperature("jay"), 0.7);
  assertEquals(getAgentTemperature("may"), 0.3);
  assertEquals(getAgentTemperature("cece"), 0.5);
});

Deno.test("getAgentTemperature - falls back for unknown agent", () => {
  assertEquals(getAgentTemperature("unknown"), 0.5);
});

// ============= buildSystemPrompt Tests =============

Deno.test("buildSystemPrompt - includes agent base prompt", () => {
  const result = buildSystemPrompt("jay");
  assertStringIncludes(result, "Jay");
  assertStringIncludes(result, "sales assistant");
});

Deno.test("buildSystemPrompt - includes date context", () => {
  const result = buildSystemPrompt("may");
  assertStringIncludes(result, "CRITICAL - CURRENT DATE AWARENESS");
});

Deno.test("buildSystemPrompt - includes conversation instructions", () => {
  const result = buildSystemPrompt("cece");
  assertStringIncludes(result, "CONVERSATION CONTINUITY INSTRUCTIONS");
});

Deno.test("buildSystemPrompt - includes image instructions", () => {
  const result = buildSystemPrompt("jay");
  assertStringIncludes(result, "IMAGE SHARING INSTRUCTIONS");
});

Deno.test("buildSystemPrompt - includes response format guidance", () => {
  const result = buildSystemPrompt("jay");
  assertStringIncludes(result, "RESPONSE FORMAT");
});

Deno.test("buildSystemPrompt - includes knowledge base when provided", () => {
  const result = buildSystemPrompt("jay", {
    knowledgeBase: "Product A costs $100. Product B costs $200.",
  });
  assertStringIncludes(result, "KNOWLEDGE BASE");
  assertStringIncludes(result, "Product A costs $100");
});

Deno.test("buildSystemPrompt - includes additional context when provided", () => {
  const result = buildSystemPrompt("may", {
    additionalContext: "Special promotion: 20% off all orders today!",
  });
  assertStringIncludes(result, "20% off all orders");
});

Deno.test("buildSystemPrompt - applies language lock when enabled", () => {
  const result = buildSystemPrompt("cece", {
    allowedLanguages: ["en", "tl"],
    languageLockEnabled: true,
    isExemptOrg: false,
  });
  assertStringIncludes(result, "ONLY allowed to respond");
  assertStringIncludes(result, "English");
});

Deno.test("buildSystemPrompt - defaults to jay for unknown agent", () => {
  const result = buildSystemPrompt("unknown_agent" as AgentType);
  assertStringIncludes(result, "Jay");
});

// ============= isExemptOrganization Tests =============

Deno.test("isExemptOrganization - returns true for guilcor", () => {
  assertEquals(isExemptOrganization("Guilcor Company"), true);
  assertEquals(isExemptOrganization("GUILCOR"), true);
  assertEquals(isExemptOrganization("guilcor inc"), true);
});

Deno.test("isExemptOrganization - returns true for cohost solutions", () => {
  assertEquals(isExemptOrganization("Cohost Solutions"), true);
  assertEquals(isExemptOrganization("COHOST SOLUTIONS LLC"), true);
});

Deno.test("isExemptOrganization - returns false for other orgs", () => {
  assertEquals(isExemptOrganization("Random Company"), false);
  assertEquals(isExemptOrganization("Test Org"), false);
  assertEquals(isExemptOrganization(""), false);
});

// ============= Integration Tests =============

Deno.test("integration - full system prompt for Cece with all options", () => {
  const result = buildSystemPrompt("cece", {
    allowedLanguages: ["en", "tl", "ceb"],
    languageLockEnabled: true,
    isExemptOrg: false,
    knowledgeBase: "Room 101: Ocean View Suite, $150/night\nRoom 102: Garden Room, $100/night",
    additionalContext: "Current promotion: Stay 3 nights, get 1 free!",
  });

  // Should include all key components
  assertStringIncludes(result, "Cece");
  assertStringIncludes(result, "concierge");
  assertStringIncludes(result, "DATE HANDLING FOR BOOKINGS");
  assertStringIncludes(result, "ONLY allowed to respond");
  assertStringIncludes(result, "English");
  assertStringIncludes(result, "Tagalog");
  assertStringIncludes(result, "Cebuano");
  assertStringIncludes(result, "Today is:");
  assertStringIncludes(result, "CONVERSATION CONTINUITY");
  assertStringIncludes(result, "IMAGE SHARING");
  assertStringIncludes(result, "Room 101");
  assertStringIncludes(result, "Stay 3 nights");
});

Deno.test("integration - exempt org bypasses language restrictions", () => {
  const result = buildSystemPrompt("jay", {
    allowedLanguages: ["en"],
    languageLockEnabled: true,
    isExemptOrg: true,
  });

  // Should have unrestricted language instructions
  assertStringIncludes(result, "NOT restricted");
  // Should NOT have restricted language message
  assertEquals(result.includes("ONLY allowed to respond"), false);
});

console.log("\n✅ All ai-utils tests defined. Run with: deno test --allow-env supabase/functions/_tests/ai-utils.test.ts\n");
