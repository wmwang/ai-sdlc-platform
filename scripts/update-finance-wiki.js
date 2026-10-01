/**
 * 全球主要金融市場行情抓取並自動同步至 Azure DevOps Wiki
 */

const https = require('https');

// 設定 Azure DevOps 組織與專案資訊
const ORG = process.env.ADO_ORG || 'wmwangf';
const PROJECT = process.env.ADO_PROJECT || 'SDLC';
const WIKI_ID = process.env.ADO_WIKI_ID || '09b02d2c-b627-4083-b978-5ac54de52d34';
const PAGE_PATH = '/Financial-Markets';

const TOKEN = process.env.ADO_PAT || process.env.SYSTEM_ACCESSTOKEN || 'REMOVED_TOKEN';

function getAuthHeader(token) {
  if (token.split('.').length === 3) {
    return 'Bearer ' + token;
  }
  return 'Basic ' + Buffer.from(':' + token).toString('base64');
}

const AUTH_HEADER = getAuthHeader(TOKEN);

// 追蹤的全球金融標的清單
const ASSETS = [
  // 全球主要股市指數
  { category: '全球主要股指', name: '標普 500 (S&P 500)', symbol: '^GSPC' },
  { category: '全球主要股指', name: '道瓊工業指數 (Dow Jones)', symbol: '^DJI' },
  { category: '全球主要股指', name: '那斯達克 (Nasdaq)', symbol: '^IXIC' },
  { category: '全球主要股指', name: '台灣加權指數 (TAIEX)', symbol: '^TWII' },
  { category: '全球主要股指', name: '日經 225 (Nikkei 225)', symbol: '^N225' },

  // 大宗商品
  { category: '大宗商品', name: '黃金期貨 (Gold)', symbol: 'GC=F' },
  { category: '大宗商品', name: '紐約輕原油 (WTI Crude)', symbol: 'CL=F' },

  // 加密貨幣
  { category: '加密貨幣', name: '比特幣 (BTC / USD)', symbol: 'BTC-USD' },
  { category: '加密貨幣', name: '以太幣 (ETH / USD)', symbol: 'ETH-USD' },

  // 外匯市場
  { category: '外匯匯率', name: '美元 / 新台幣 (USD / TWD)', symbol: 'USDTWD=X' },
  { category: '外匯匯率', name: '美元 / 日圓 (USD / JPY)', symbol: 'USDJPY=X' }
];

/**
 * 從 Yahoo Finance API 取得即時報價
 */
function fetchQuote(symbol) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const meta = json.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          const change = price - prev;
          const pct = (change / prev) * 100;
          resolve({
            price,
            change,
            pct,
            currency: meta.currency,
            success: true
          });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    }).on('error', (err) => resolve({ success: false, error: err.message }));
  });
}

/**
 * 格式化數值
 */
function formatNumber(num, decimals = 2) {
  if (num === undefined || num === null || isNaN(num)) return '-';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * 產生 Markdown 表格
 */
function buildMarkdownContent(results) {
  const now = new Date();
  const timeString = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  const buildId = process.env.BUILD_BUILDID || '手動/本地觸發';
  const commitId = (process.env.BUILD_SOURCEVERSION || '').substring(0, 7) || 'HEAD';

  let md = `# 📈 全球主要金融市場即時行情看板\n\n`;
  md += `> [!NOTE]\n`;
  md += `> 此頁面由 **Azure DevOps CI Pipeline** 定期自動抓取更新。\n`;
  md += `> **最後更新時間**：\`${timeString} (UTC+8)\`  \n`;
  md += `> **建置編號 (Build ID)**：\`${buildId}\` ｜ **Commit 版本**：\`${commitId}\`\n\n`;
  md += `👉 **[切換至 🌍 世界主要城市天氣看板](/World-Weather)**\n\n`;

  // 依分類建立表格
  const categories = ['全球主要股指', '大宗商品', '加密貨幣', '外匯匯率'];

  for (const cat of categories) {
    md += `### 📌 ${cat}\n\n`;
    md += `| 標的名稱 | 代碼 | 最新價格 | 漲跌額 | 漲跌幅 (%) | 趨勢 |\n`;
    md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

    const catItems = results.filter(r => r.category === cat);
    for (const item of catItems) {
      if (!item.success) {
        md += `| **${item.name}** | \`${item.symbol}\` | - | - | - | ⚪ 資料讀取中 |\n`;
        continue;
      }

      const isUp = item.change > 0;
      const isDown = item.change < 0;
      const sign = isUp ? '+' : '';
      const trendIcon = isUp ? '🟢 📈' : (isDown ? '🔴 📉' : '⚪ ➖');

      const priceStr = formatNumber(item.price);
      const changeStr = `${sign}${formatNumber(item.change)}`;
      const pctStr = `${sign}${formatNumber(item.pct)}%`;

      md += `| **${item.name}** | \`${item.symbol}\` | **${priceStr}** | ${changeStr} | **${pctStr}** | ${trendIcon} |\n`;
    }
    md += `\n`;
  }

  md += `---\n`;
  md += `### 💡 資料說明與自動化流程\n`;
  md += `* **報價更新頻率**：隨 CI Pipeline 排程定期自動更新（支援每 4 小時自動執行與隨時手動觸發）。\n`;
  md += `* **資料來源**：全球金融公開市場即時數據接口。\n`;

  return md;
}

/**
 * 推送至 Azure DevOps Wiki
 */
async function updateWikiPage(content) {
  const pageApiUrl = `https://dev.azure.com/${ORG}/${PROJECT}/_apis/wiki/wikis/${WIKI_ID}/pages?path=${encodeURIComponent(PAGE_PATH)}&api-version=7.0`;

  let etag = null;
  await new Promise(resolve => {
    https.get(pageApiUrl, {
      headers: {
        'Authorization': AUTH_HEADER,
        'Accept': 'application/json'
      }
    }, res => {
      etag = res.headers['etag'];
      resolve();
    }).on('error', () => resolve());
  });

  const putHeaders = {
    'Authorization': AUTH_HEADER,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (etag) {
    putHeaders['If-Match'] = etag;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(pageApiUrl, {
      method: 'PUT',
      headers: putHeaders
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`Wiki 金融看板頁面更新成功！HTTP 狀態碼: ${res.statusCode}`);
          resolve(data);
        } else {
          reject(new Error(`Wiki 更新失敗: HTTP ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ content }));
    req.end();
  });
}

/**
 * 主程式
 */
async function main() {
  console.log('開始蒐集全球主要金融市場最新報價...');
  const results = [];

  for (const asset of ASSETS) {
    console.log(`正在讀取 [${asset.category}] ${asset.name} (${asset.symbol})...`);
    const quote = await fetchQuote(asset.symbol);
    results.push({ ...asset, ...quote });
  }

  console.log('行情數據取得完成，正在產生 Markdown 看板...');
  const mdContent = buildMarkdownContent(results);

  console.log('正在推送更新至 Azure DevOps Wiki (/Financial-Markets)...');
  await updateWikiPage(mdContent);
  console.log('金融市場行情 Wiki 更新完成！');
}

main().catch(err => {
  console.error('執行過程發生錯誤:', err);
  process.exit(1);
});
