import assert from "node:assert/strict";
import test from "node:test";
import http from 'node:http';
import { AI_PROVIDER_PRESETS } from '../../src/shared/aiProviders.js';
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

const sampleBatch = [{ key: '猫', value: '猫', status: 'untranslated' }];
const sampleOutput = '{"items":[{"key":"猫","value":"猫咪","status":"translated"}]}';

test('本地 OpenAI 兼容服务不要求 Key，真实 HTTP 请求可以完成一个翻译批次', async t => {
  let received;
  const server = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    received = { url: request.url, headers: request.headers, body: JSON.parse(body) };
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: sampleOutput } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const result = await requestTranslationBatch({ ...baseConfig, apiKey: '', provider: 'custom', protocol: 'openai-chat', baseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: 'local-sakura' }, sampleBatch);
  assert.equal(received.url, '/v1/chat/completions');
  assert.equal(received.headers.authorization, undefined);
  assert.equal(received.body.model, 'local-sakura');
  assert.equal(received.body.stream, false);
  assert.equal(received.body.response_format, undefined);
  assert.equal(received.body.thinking, undefined);
  assert.deepEqual(result, { 猫: { value: '猫咪', status: 'translated' } });
});

test('Anthropic 中转协议使用顶层 system、版本和 Key 请求头，解析 text 块', async () => {
  let captured;
  const result = await requestTranslationBatch({ ...baseConfig, provider: 'custom', protocol: 'anthropic', baseUrl: 'https://relay.example/anthropic' }, sampleBatch, {
    fetchImpl: async (url, init) => {
      captured = { url, headers: init.headers, body: JSON.parse(init.body) };
      return jsonResponse({ content: [{ type: 'thinking', thinking: 'ignored' }, { type: 'text', text: sampleOutput }], stop_reason: 'end_turn' });
    },
  });
  assert.equal(captured.url, 'https://relay.example/anthropic/v1/messages');
  assert.equal(captured.headers['x-api-key'], 'test-key');
  assert.equal(captured.headers['anthropic-version'], '2023-06-01');
  assert.equal(captured.headers.Authorization, undefined);
  assert.match(captured.body.system, /游戏文本翻译器/);
  assert.deepEqual(captured.body.messages.map(item => item.role), ['user']);
  assert.equal(captured.body.response_format, undefined);
  assert.deepEqual(result, { 猫: { value: '猫咪', status: 'translated' } });
});

test('自定义 Responses 和完整端点地址不被重复拼接，可关闭 JSON 参数且不附加推理参数', async () => {
  for (const [protocol, suffix, payload] of [
    ['openai-chat', '/chat/completions', { choices: [{ message: { content: sampleOutput } }] }],
    ['openai-responses', '/responses', { output: [{ content: [{ type: 'output_text', text: sampleOutput }] }] }],
    ['anthropic', '/messages', { content: [{ type: 'text', text: sampleOutput }] }],
  ]) {
    let captured;
    const url = `https://relay.example/v1${suffix}`;
    await requestTranslationBatch({ ...baseConfig, provider: 'custom', protocol, baseUrl: `${url}/`, jsonMode: false }, sampleBatch, {
      fetchImpl: async (requestUrl, init) => { captured = { url: requestUrl, body: JSON.parse(init.body) }; return jsonResponse(payload); },
    });
    assert.equal(captured.url, url);
    assert.equal(captured.body.response_format, undefined);
    assert.equal(captured.body.text, undefined);
    assert.equal(captured.body.reasoning, undefined);
    assert.equal(captured.body.stream, false);
  }
});

test('中转地址不会收到官方厂商扩展字段，JSON 选项可显式启用', async () => {
  let body;
  await requestTranslationBatch({ ...baseConfig, provider: 'deepseek', baseUrl: 'https://relay.example/v1', jsonMode: true }, sampleBatch, {
    fetchImpl: async (_url, init) => { body = JSON.parse(init.body); return jsonResponse({ choices: [{ message: { content: sampleOutput } }] }); },
  });
  assert.equal(body.thinking, undefined);
  assert.deepEqual(body.response_format, { type: 'json_object' });
});

test('所有厂商预设均可走连接测试，Astra 不发送不支持的 none 推理参数', async () => {
  for (const preset of AI_PROVIDER_PRESETS.filter(item => item.value !== 'custom')) {
    let captured;
    const result = await testAIProviderConnection({ ...baseConfig, provider: preset.value, baseUrl: preset.baseUrl, model: preset.models[0].value }, {
      fetchImpl: async (url, init) => {
        captured = { url, headers: init.headers, body: JSON.parse(init.body) };
        return jsonResponse(preset.protocol === 'anthropic' ? { content: [{ type: 'text', text: '{"ok":true}' }] }
          : preset.protocol === 'openai-responses' ? { output_text: '{"ok":true}' } : { choices: [{ message: { content: '{"ok":true}' } }] });
      },
    });
    assert.equal(result.provider, preset.value);
    assert.equal(result.model, preset.models[0].value);
    if (preset.value === 'openai') assert.deepEqual(captured.body.reasoning, { effort: 'low' });
    if (preset.value === 'anthropic') assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
  }
});

test('缺少远程 Key、错误协议、非法地址和协议端点不匹配在发送前拒绝', async () => {
  const configs = [
    { baseUrl: 'https://relay.example/v1', apiKey: '' },
    { baseUrl: 'http://192.168.1.2/v1' },
    { baseUrl: 'ftp://localhost/v1' },
    { baseUrl: 'https://user:secret@relay.example/v1' },
    { baseUrl: 'https://relay.example/v1?key=secret' },
    { baseUrl: 'https://relay.example/v1', protocol: 'unknown' },
    { baseUrl: 'https://relay.example/v1/messages', protocol: 'openai-chat' },
    { baseUrl: 'https://relay.example/v1', jsonMode: 'true' },
  ];
  for (const overrides of configs) {
    await assert.rejects(testAIProviderConnection({ ...baseConfig, provider: 'custom', ...overrides }, { fetchImpl: () => assert.fail('无效配置不应发请求') }));
  }
});

test('IPv6 回环无 Key 可用，远程 400／422 错误不回显服务商返回的 Key', async () => {
  await testAIProviderConnection({ ...baseConfig, provider: 'custom', baseUrl: 'http://[::1]:8080/v1', apiKey: '' }, {
    fetchImpl: async (_url, init) => { assert.equal(init.headers.Authorization, undefined); return jsonResponse({ choices: [{ message: { content: '{"ok":true}' } }] }); },
  });
  for (const status of [400, 422]) await assert.rejects(testAIProviderConnection({ ...baseConfig, provider: 'custom', baseUrl: 'https://relay.example/v1' }, {
    fetchImpl: async () => jsonResponse({ error: { message: 'invalid test-key' } }, status),
  }), error => !error.message.includes('test-key') && error.status === status);
});

test('三种协议输出截断时返回可拆批错误，不保存不完整译文', async () => {
  for (const [protocol, payload] of [
    ['openai-chat', { choices: [{ finish_reason: 'length', message: { content: sampleOutput } }] }],
    ['openai-responses', { status: 'incomplete', output_text: sampleOutput }],
    ['anthropic', { stop_reason: 'max_tokens', content: [{ type: 'text', text: sampleOutput }] }],
  ]) await assert.rejects(requestTranslationBatch({ ...baseConfig, provider: 'custom', protocol, baseUrl: 'https://relay.example/v1' }, sampleBatch, { fetchImpl: async () => jsonResponse(payload) }), error => error.kind === 'invalid_response');
});
