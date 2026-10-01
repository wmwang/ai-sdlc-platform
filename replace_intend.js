const fs = require('fs');
let content = fs.readFileSync('scripts/sdlc.js', 'utf8');

const newIntend = `
async function handleIntend(pbiId) {
  log(\`正在讀取 PBI #\${pbiId} 的需求內容...\`);
  const wi = await client.getWorkItem(pbiId);
  const title = wi.fields['System.Title'] || '未命名需求';
  const desc = cleanDescription(wi.fields['System.Description']);

  log(\`🤖 正在呼叫 agy 引擎進行需求反詰...\`);
  const { spawnSync } = require('child_process');
  
  const prompt = \`你是一位資深業務分析師 (BA) 與系統架構師。請閱讀以下需求：
標題：\${title}
描述：\${desc}

請針對這個需求，提出 2~3 個最重要的邊界條件、異常處理或安全性提問，向使用者釐清。
輸出格式：直接給出一份 HTML 格式的條列式提問，使用 <ul> 與 <li>，不要有 Markdown code block。\`;

  const aiResult = spawnSync('agy', ['--print', prompt], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (aiResult.error || aiResult.status !== 0) throw new Error('AI 生成失敗');
  
  const questionsHtml = aiResult.stdout.trim().replace(/^\`\`\`html/, '').replace(/\`\`\`$/, '').trim();

  // (以下原邏輯保留，僅替換問題生成內容)
  const intendCard = renderFluentCard({
    accentColor: '#0078d4',
    badgeText: 'Intend Phase',
    title: '🤖 [AI 需求反詰] 偵測到新需求，請協助釐清邊界條件',
    description: '為了確保架構與代碼完全符合業務情境，AI 提出了以下確認事項：',
    contentHtml: questionsHtml,
    footerHtml: \`👉 <strong>請在下方留言回覆</strong>。AI 將在下一次巡邏時抓取您的回覆並收斂為驗收標準。\`,
    step: 1
  });

  log(\`正在將 AI 提問留言至討論區...\`);
  await client.addWorkItemComment(pbiId, intendCard);

  const intendTag = (CONFIG.scrum && CONFIG.scrum.tags && CONFIG.scrum.tags.stage1_wait) || '[1/5]-需求反詰(等回覆)';
  await client.updateWorkItem(pbiId, {
    'System.Tags': transitionSdlcTags(wi.fields['System.Tags'], intendTag)
  });
  log(\`✅ 需求反詰提問已留言，PBI 標籤流轉為 [1/5]\`);
}

async function handleConfirmIntend(pbiId) {
  log(\`正在抓取 PBI #\${pbiId} 的討論區留言...\`);
  const wi = await client.getWorkItem(pbiId);
  const title = wi.fields['System.Title'] || '未命名需求';
  const desc = cleanDescription(wi.fields['System.Description']);
  const comments = await client.getWorkItemComments(pbiId);

  const humanComments = comments
    .filter(c => !c.text.includes('Intend Phase') && !c.text.includes('Design Phase') && !c.text.includes('AI') && !c.text.includes('🤖'))
    .map(c => stripHtml(c.text))
    .join('\\n');

  log(\`🤖 正在呼叫 agy 引擎收斂 Gherkin 驗收標準...\`);
  const { spawnSync } = require('child_process');
  
  const prompt = \`你是一位資深 QA 與架構師。請根據以下原始需求，以及團隊討論區的回覆，收斂出標準的 Gherkin (Given/When/Then) 驗收標準。
【原始需求標題】：\${title}
【原始需求描述】：\${desc}
【團隊回覆補充】：\${humanComments}

請以 HTML 格式輸出 (使用 <div>, <strong>, <ul>, <li> 等)，排版要清楚美觀，直接輸出 HTML，絕對不要包裝在 markdown block 中。\`;

  const aiResult = spawnSync('agy', ['--print', prompt], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (aiResult.error || aiResult.status !== 0) throw new Error('AI 生成失敗');
  
  const acContent = aiResult.stdout.trim().replace(/^\`\`\`html/, '').replace(/\`\`\`$/, '').trim();

  log(\`正在更新 PBI #\${pbiId} 的 Acceptance Criteria...\`);
  const readyTag = (CONFIG.scrum && CONFIG.scrum.tags && CONFIG.scrum.tags.stage2_ready) || '[2/5]-驗收確立(完成)';
  const updatedTags = transitionSdlcTags(wi.fields['System.Tags'], readyTag);
  
  await client.updateWorkItem(pbiId, {
    'Microsoft.VSTS.Common.AcceptanceCriteria': acContent,
    'System.Tags': updatedTags
  });

  const confirmCard = renderFluentCard({
    accentColor: '#107c41',
    badgeText: 'Confirm Intend Phase',
    title: '🤖 [AI 驗收收斂] 驗收標準已更新',
    description: \`已結合團隊討論區回饋，動態收斂出標準 Gherkin 驗收標準。\`,
    contentHtml: \`<div style="padding: 10px 14px; background-color: #f3f9f4; border: 1px solid #dff6dd; border-radius: 4px; color: #107c41;">✅ <strong>已完成項目</strong>：驗收條件已更新至 <code>Acceptance Criteria</code> 欄位，標籤已自動推進為 <code>\${readyTag}</code>。</div>\`,
    footerHtml: \`👉 <strong>下一步</strong>：AI 將產出 Spring Boot 架構設計規格書！\`,
    step: 2
  });

  await client.addWorkItemComment(pbiId, confirmCard);
  log(\`✅ 驗收標準更新成功，PBI 標籤流轉為 [2/5]\`);
}
`;

const intendStart = 'async function handleIntend(pbiId) {';
const designStart = 'async function handleDesign(pbiId) {'; // The one after handleConfirmIntend

const startIndex = content.indexOf(intendStart);
const endIndex = content.indexOf(designStart);

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  fs.writeFileSync('scripts/sdlc.js', before + newIntend + '\n' + after, 'utf8');
  console.log('✅ 需求提問與驗收標準區塊替換成功');
} else {
  console.log('❌ 找不到目標區塊');
}
