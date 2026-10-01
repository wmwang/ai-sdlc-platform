const fs = require('fs');
let content = fs.readFileSync('scripts/sdlc.js', 'utf8');

const newPrompt = `const prompt = \`你是一位資深業務分析師 (BA) 與系統架構師。請閱讀以下需求：
標題：\${title}
描述：\${desc}

請針對這個需求進行深度分析。如果需求中有模糊不清、遺漏的邊界條件、異常處理或安全性考量，請向使用者提出釐清問題。
【重要】：請由你（AI）自行判斷需要問幾個問題。如果需求非常明確，可以不用提問；如果漏洞百出，請把所有致命問題都列出來。
輸出格式：請直接輸出 HTML 格式的內容（如 <ul>, <li> 或適當的排版），不要包裝在 Markdown code block 中。\`;`;

content = content.replace(/const prompt = `你是一位資深業務分析師.*?不要有 Markdown code block。`;/s, newPrompt);

fs.writeFileSync('scripts/sdlc.js', content, 'utf8');
console.log('✅ 提問 Prompt 已修正為動態判斷數量');
