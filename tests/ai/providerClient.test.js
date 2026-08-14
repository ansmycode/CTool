import assert from "node:assert/strict";
import test from "node:test";
import {
  requestTranslationBatch,
  testAIProviderConnection,
  validateTranslationItems,
} from "../../src/electron/ai/providerClient.js";

const baseConfig = {
  apiKey: "test-key",
  model: "test-model",
  sourceLanguage: "日语",
  targetLanguage: "简体中文",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("DeepSeek 翻译请求使用 chat/completions 和 JSON 模式", async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return jsonResponse({
      choices: [{ message: { content: '{"items":[{"key":"猫","value":"猫咪","status":"translated"}]}' } }],
    });
  };

  const result = await requestTranslationBatch(
    { ...baseConfig, provider: "deepseek", baseUrl: "https://api.deepseek.com" },
    [{ key: "猫", value: "猫", status: "untranslated" }],
    { fetchImpl },
  );

  assert.equal(captured.url, "https://api.deepseek.com/chat/completions");
  assert.deepEqual(captured.body.response_format, { type: "json_object" });
  assert.deepEqual(captured.body.thinking, { type: "disabled" });
  assert.equal(captured.init.headers.Authorization, "Bearer test-key");
  assert.deepEqual(result, { 猫: { value: "猫咪", status: "translated" } });
});

test("OpenAI 连接测试使用 Responses API", async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return jsonResponse({ output: [{ content: [{ type: "output_text", text: '{"ok":true}' }] }] });
  };

  const result = await testAIProviderConnection(
    { ...baseConfig, provider: "openai", baseUrl: "https://api.openai.com/v1" },
    { fetchImpl },
  );

  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.body.model, "test-model");
  assert.equal(result.success, true);
});

test("响应校验拒绝缺失 key 和跳过时篡改原文", () => {
  const batch = [{ key: "A", value: "A", status: "untranslated" }];
  assert.throws(() => validateTranslationItems(batch, []), /条目数量/);
  assert.throws(
    () => validateTranslationItems(batch, [{ key: "A", value: "甲", status: "skipped" }]),
    /修改了原文/,
  );
});

test("鉴权错误不会回显 API Key", async () => {
  const fetchImpl = async () => jsonResponse({ error: { message: "bad key test-key" } }, 401);
  await assert.rejects(
    () =>
      testAIProviderConnection(
        { ...baseConfig, provider: "deepseek", baseUrl: "https://api.deepseek.com" },
        { fetchImpl },
      ),
    (error) => error.message === "API Key 无效或没有访问权限。" && !error.message.includes("test-key"),
  );
});

test("限流响应会读取 Retry-After", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ error: { message: "rate limited" } }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "3" },
    });
  await assert.rejects(
    () =>
      testAIProviderConnection(
        { ...baseConfig, provider: "deepseek", baseUrl: "https://api.deepseek.com" },
        { fetchImpl },
      ),
    (error) => error.retryable === true && error.retryAfterMs === 3000,
  );
});
