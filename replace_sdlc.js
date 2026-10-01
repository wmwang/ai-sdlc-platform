const fs = require('fs');

let content = fs.readFileSync('scripts/sdlc.js', 'utf8');

// Replace handleDesign mock with actual AI call
const handleDesignReplacement = `async function handleDesign(pbiId) {
  log(\`正在讀取 PBI #\${pbiId} 資訊與驗收標準...\`);
  const wi = await client.getWorkItem(pbiId);
  const title = wi.fields['System.Title'] || '未命名需求';
  const desc = cleanDescription(wi.fields['System.Description']);
  const ac = formatAcceptanceCriteria(wi.fields['Microsoft.VSTS.Common.AcceptanceCriteria']);

  const slug = slugify(title).substring(0, 30);
  const wikiPath = \`/Designs/PBI-\${pbiId}-\${slug}\`;
  
  log(\`🤖 正在呼叫 agy 引擎，動態產出 Java Spring Boot 架構規格文件...\`);
  const { spawnSync } = require('child_process');
  
  const prompt = \`你是一位資深 Java 架構師。請根據以下 PBI 資訊，產出一份 Markdown 格式的 Spring Boot 3 + RESTful API 架構設計規格書 (RFC)。
【標題】：\${title}
【描述】：\${desc}
【驗收標準】：
\${ac}

要求：
1. 包含 業務背景、API 端點契約 (URL、Method)、Request/Response JSON 結構。
2. 包含領域實體 (Entity) 與欄位設計。
3. 嚴格遵守 Markdown 格式，不要在最外層包 \`\\\`\\\`markdown\` 標籤，直接輸出純 Markdown 內容。
\`;

  const aiResult = spawnSync('agy', ['--print', prompt], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (aiResult.error || aiResult.status !== 0) {
    throw new Error('AI 引擎呼叫失敗: ' + (aiResult.error ? aiResult.error.message : '非零退出碼'));
  }
  
  const wikiContent = aiResult.stdout.trim();

  log(\`正在將設計規格同步至 Azure Wiki：\${wikiPath}...\`);
  const updateRes = await client.updateWikiPage(wikiPath, wikiContent, \`feat: 產出 PBI #\${pbiId} 架構規格 (AI Generated)\`);
  const pageUrl = \`\${client.orgUrl}/\${encodeURIComponent(client.project)}/_wiki/wikis/\${client.wikiId}?pagePath=\${encodeURIComponent(wikiPath)}\`;
  
  log(\`正在更新 PBI #\${pbiId} 欄位與留言...\`);
  await client.updateWorkItem(pbiId, {
    'System.Tags': '[3/5]-架構設計(完成); ai-candidate',
    'Microsoft.VSTS.Common.AcceptanceCriteria': ac + \`\\n\\n<br><br><b>[AI 架構規格書已發布]</b> <a href="\${pageUrl}" target="_blank">點此檢閱設計規格</a>\`
  });
  
  const designCard = renderFluentCard({
    accentColor: '#5c2d91',
    badgeText: 'Design Phase',
    title: '🤖 [AI 生成] Java Spring Boot 架構規格書已發布',
    description: \`agy 引擎已動態分析需求，並產出對應之 Technical Design RFC 規格文件。\`,
    contentHtml: \`<div style="font-weight: 600; color: #5c2d91; margin-bottom: 6px;">📐 規格書包含重點：</div>
  <ul style="margin: 0 0 0 18px; padding: 0; color: #495057;">
    <li><strong>RESTful API 契約</strong>：端點、Request/Response DTO 結構定義</li>
    <li><strong>領域實體設計</strong>：JPA Entity 關聯與欄位限制</li>
  </ul>\`,
    footerHtml: \`👉 <a href="\${pageUrl}" style="color: #0078d4; font-weight: 600;">點此前往 Wiki 檢閱規格書</a>\`,
    step: 3
  });
  
  await client.addWorkItemComment(pbiId, designCard);
  log(\`✅ 架構設計規格已成功由 AI 生成並同步至 Wiki，標籤已標記為 [[3/5]-架構設計(完成)]，靜候看板狀態變更為 [Approved]！\`);
}`;

content = content.replace(/async function handleDesign\(pbiId\) \{[\s\S]*?log\(`✅ 架構設計規格已成功同步至 Wiki，標籤已標記為 \[\[3\/5\]-架構設計\(完成\)]，靜候看板狀態變更為 \[Approved\]！`\);\n}/, handleDesignReplacement);

fs.writeFileSync('scripts/sdlc.js', content, 'utf8');
console.log('✅ 替換完成');
