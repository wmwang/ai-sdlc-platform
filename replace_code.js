const fs = require('fs');
let content = fs.readFileSync('scripts/sdlc.js', 'utf8');

const newFunction = `
function generateSpringCodeWithSkill({ rootDir, pbiId, title, slug, ac, wikiSpec, skillRules }) {
  log(\`🤖 [Skill Engine] 正在呼叫 agy 引擎動態生成 Java Spring Boot 程式碼與單元測試...\`);
  const { spawnSync } = require('child_process');
  const path = require('path');
  const fs = require('fs');

  const prompt = \`你是一個強大的 Java 程式開發 AI。請根據以下 PBI 資訊，實作完整的 Spring Boot 3 專案代碼。
【需求 ID】：\${pbiId}
【標題】：\${title}
【驗收標準】：\${ac}
【架構規格】：\${wikiSpec}

請輸出嚴格的 JSON 格式，【絕對不要】包含 markdown 標記 (如 \`\`\`json)，直接輸出純 JSON 物件。
JSON 格式規範：
- 鍵 (Key) 為檔案相對路徑，例如 "src/main/java/com/company/sdlc/feature\${pbiId}/Application.java", "src/test/java/com/company/sdlc/feature\${pbiId}/service/Pbi\${pbiId}ServiceTest.java" 
- 值 (Value) 為該檔案的 Java 原始碼字串。
- 必須包含 Controller, Service, Repository, DTO, Entity, Pom.xml 以及 JUnit 5 測試程式碼，確保所有 package 與 import 路徑完全對齊。
\`;
  
  const aiResult = spawnSync('agy', ['--print', prompt], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (aiResult.error || aiResult.status !== 0) {
    throw new Error('AI 引擎呼叫失敗: ' + (aiResult.error ? aiResult.error.message : '非零退出碼'));
  }
  
  let rawJson = aiResult.stdout.trim();
  if (rawJson.startsWith('\`\`\`json')) { rawJson = rawJson.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim(); }
  else if (rawJson.startsWith('\`\`\`')) { rawJson = rawJson.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim(); }
  
  let codeMap;
  try {
    codeMap = JSON.parse(rawJson);
  } catch (e) {
    log(\`[WARN] AI 輸出的 JSON 無法解析: \` + e.message);
    throw e;
  }

  for (const [relPath, sourceCode] of Object.entries(codeMap)) {
    const fullPath = path.join(rootDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, sourceCode, 'utf8');
    log(\`✅ [AI 智能生成] 寫入檔案：\${relPath}\`);
  }
}
`;

const funcStart = 'function generateSpringCodeWithSkill({ rootDir, pbiId, title, slug, ac, wikiSpec, skillRules }) {';
const nextFunc = 'async function handleImplement(pbiId) {';

const startIndex = content.indexOf(funcStart);
const endIndex = content.indexOf(nextFunc);

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  fs.writeFileSync('scripts/sdlc.js', before + newFunction + '\n' + after, 'utf8');
  console.log('✅ 程式產生區塊替換成功');
} else {
  console.log('❌ 找不到目標區塊');
}
