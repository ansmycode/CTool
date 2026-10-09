import { useEffect, useState } from "react";
import { message, Button, Modal, Tooltip, Typography, Alert } from "antd";
import type { GameSessionSnapshot } from '@/types/GameSession';
import AITranslation from "@/ui/AITranslation";
import type { GameTextExtractionResult, GameTextTranslationAccess, GameTextTranslationStatus } from "@/game/textTranslation";
import "./index.css";

export default function WolfTranslationPage({ access, restore }: { access?: GameTextTranslationAccess; restore?: GameSessionSnapshot['translationRestore'] }) {
  const [messageApi, messageContext] = message.useMessage();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GameTextExtractionResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [translation, setTranslation] = useState<GameTextTranslationStatus | null>(null);
  useEffect(() => {
    let active = true;
    access?.status().then(value => { if (active) setTranslation(value); }).catch(() => {});
    return () => { active = false; };
  }, [access, restore?.state, restore?.loaded, restore?.message]);
  const load = async (unload = false) => {
    if (!access || busy) return;
    setBusy(true);
    try {
      const value = await (unload ? access.unload() : access.load());
      if (value) {
        setTranslation(value);
        if(value.persistenceError)void messageApi.warning('当前操作已生效，但自动恢复设置保存失败：'+value.persistenceError);
        else void messageApi.success(unload ? '已卸载译文并取消下次自动恢复' : `已载入 ${value.loaded} 条译文，后续启动自动恢复`);
      }
    } catch (error) { void messageApi.error(error instanceof Error ? error.message : '译文加载失败'); }
    finally { setBusy(false); }
  };
  const extract = async () => {
    if (!access || busy) return;
    setBusy(true);
    try { setResult(await access.extract()); setDetailsOpen(true); }
    catch (error) { void messageApi.error(error instanceof Error ? error.message : '文本提取失败'); }
    finally { setBusy(false); }
  };
  return (
    <div className="wolf-translation-page">
      {messageContext}
      <header className="tool-page-header">
        <div>
          <Typography.Title level={3}>翻译工具</Typography.Title>
          <Typography.Text type="secondary">
            提取 Wolf 文本、AI 翻译并加载到当前游戏；文件内嵌待接入。
          </Typography.Text>
          <Typography.Text type="secondary" className="wolf-translation-cache-hint">
            如需重新解析，请删除游戏目录下的 .ctool-cache/wolf-text 文件夹，再提取文本。
          </Typography.Text>
          <Typography.Text type="secondary" className="wolf-translation-cache-hint">
            首次选择任意位置的译文 JSON；加载成功后保存独立副本，后续启动自动恢复，原文件改名或移动不影响。
          </Typography.Text>
        </div>
      </header>
      {restore?.state==='failed'&&<Alert type="warning" showIcon message={restore.message||'自动恢复译文失败，请重新选择译文'} />}
      {restore?.state==='loading'&&<Typography.Text type="secondary">正在检查并恢复已保存的译文…</Typography.Text>}
      <div className="wolf-translation-actions">
        {access && Object.entries(access.operations).map(([operation, state]) => (
          <Tooltip key={operation} title={state.reason}>
            <span><Button size="small" disabled={!state.available || busy || restore?.state==='loading'} loading={operation === 'extract' && busy}
              onClick={operation === 'extract' ? extract : operation === 'load' ? () => load() : undefined}>
              {state.label}{!state.available && '（待接入）'}
            </Button></span>
          </Tooltip>
        ))}
        {result && <Button size="small" type="link" onClick={() => setDetailsOpen(true)}>提取结果：{result.textCount} 条</Button>}
        {!!translation?.loaded && <>
          <Typography.Text type="secondary">已加载 {translation.loaded} 条译文{translation.faulted ? '（Hook 已停止）' : ''}</Typography.Text>
          <Button size="small" disabled={busy} onClick={() => load(true)}>卸载译文</Button>
        </>}
      </div>
      <AITranslation />
      <Modal title="Wolf 文本提取结果" open={detailsOpen} onCancel={() => setDetailsOpen(false)}
        footer={<Button type="primary" onClick={() => setDetailsOpen(false)}>知道了</Button>} width={720}
        styles={{ body: { maxHeight: '55vh', overflowY: 'auto' } }}>
        {result && <>
          <p>{result.reusedCache ? '已读取解析缓存' : '首次解析完成'}：{result.parsedFiles} 个源文件，{result.textCount} 条去重文本。</p>
          <p>在下方 AI 翻译配置中选择此纯净 JSON：</p>
          <Typography.Paragraph copyable style={{ overflowWrap: 'anywhere' }}>{result.jsonPath}</Typography.Paragraph>
          <Button onClick={() => window.electronAPI.openPathInFileManager(result.cacheDirectory)}>打开缓存目录</Button>
          <p>parsed 内保留可读文本结构和来源索引；再次提取会重新输出纯净 JSON。如需重新解析源文件，请删除整个缓存目录。</p>
          <p>AI 工作文件和译文默认也保存在此目录，清理缓存前请另存需要保留的译文。</p>
          {result.skipped.length > 0 && <>
            <Typography.Text type="warning">以下 {result.skipped.length} 个文件未提取：</Typography.Text>
            {result.skipped.map(item => <p key={item.source}>{item.source}：{item.reason}</p>)}
          </>}
        </>}
      </Modal>
    </div>
  );
}
