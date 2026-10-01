/**
 * 天氣資訊蒐集並自動同步至 Azure DevOps Wiki
 */

const https = require('https');

// 設定 Azure DevOps 組織與專案資訊
const ORG = process.env.ADO_ORG || 'wmwangf';
const PROJECT = process.env.ADO_PROJECT || 'SDLC';
// 優先使用 Wiki GUID 確保精確存取
const WIKI_ID = process.env.ADO_WIKI_ID || '09b02d2c-b627-4083-b978-5ac54de52d34';
const PAGE_PATH = '/World-Weather';

// 優先使用環境變數中的 Token，若無則使用預設 PAT
const TOKEN = process.env.ADO_PAT || process.env.SYSTEM_ACCESSTOKEN || 'REMOVED_TOKEN';

// 自動判定驗證格式 (Bearer 還是 Basic)
function getAuthHeader(token) {
  if (token.split('.').length === 3) {
    // JWT Token (System.AccessToken)
    return 'Bearer ' + token;
  }
  // PAT Token
  return 'Basic ' + Buffer.from(':' + token).toString('base64');
}

const AUTH_HEADER = getAuthHeader(TOKEN);

// 要追蹤的世界主要城市
const CITIES = [
  { name: '台北 (Taipei)', query: 'Taipei' },
  { name: '東京 (Tokyo)', query: 'Tokyo' },
  { name: '倫敦 (London)', query: 'London' },
  { name: '紐約 (New York)', query: 'New+York' },
  { name: '巴黎 (Paris)', query: 'Paris' },
  { name: '雪梨 (Sydney)', query: 'Sydney' },
  { name: '新加坡 (Singapore)', query: 'Singapore' }
];

/**
 * 簡易 HTTP GET 請求
 */
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

/**
 * 抓取單一城市天氣資訊
 */
async function getCityWeather(city) {
  try {
    const url = `https://wttr.in/${city.query}?format=j1`;
    const data = await fetchJson(url, { 'User-Agent': 'curl/8.0' });
    if (!data || !data.current_condition || !data.current_condition[0]) {
      throw new Error('無法取得天氣資料');
    }
    const current = data.current_condition[0];
    return {
      name: city.name,
      tempC: current.temp_C,
      feelsLikeC: current.FeelsLikeC,
      desc: current.weatherDesc[0].value,
      humidity: current.humidity,
      windSpeed: current.windspeedKmph,
      uvIndex: current.uvIndex,
      success: true
    };
  } catch (err) {
    console.error(`抓取 ${city.name} 天氣失敗:`, err.message);
    return {
      name: city.name,
      tempC: '-',
      feelsLikeC: '-',
      desc: '資料暫時無法讀取',
      humidity: '-',
      windSpeed: '-',
      uvIndex: '-',
      success: false
    };
  }
}

/**
 * 根據天氣狀況返回對應圖示
 */
function getWeatherIcon(desc) {
  const d = desc.toLowerCase();
  if (d.includes('sunny') || d.includes('clear')) return '☀️';
  if (d.includes('partly cloudy')) return '⛅';
  if (d.includes('cloudy') || d.includes('overcast')) return '☁️';
  if (d.includes('rain') || d.includes('drizzle')) return '🌧️';
  if (d.includes('thunder')) return '⛈️';
  if (d.includes('snow')) return '❄️';
  if (d.includes('fog') || d.includes('mist')) return '🌫️';
  return '🌡️';
}

/**
 * 產生 Markdown 格式的 Wiki 內容
 */
function buildMarkdownContent(weatherList) {
  const now = new Date();
  const timeString = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  const buildId = process.env.BUILD_BUILDID || '手動/本地觸發';
  const commitId = (process.env.BUILD_SOURCEVERSION || '').substring(0, 7) || 'HEAD';

  let md = `# 🌍 世界主要城市即時天氣看板\n\n`;
  md += `> [!NOTE]\n`;
  md += `> 此頁面由 **Azure DevOps CI Pipeline** 定期自動抓取更新。\n`;
  md += `> **最後更新時間**：\`${timeString} (UTC+8)\`  \n`;
  md += `> **建置編號 (Build ID)**：\`${buildId}\` ｜ **Commit 版本**：\`${commitId}\`\n\n`;
  md += `👉 **[切換至 📈 全球主要金融市場行情看板](/Financial-Markets)**\n\n`;

  md += `### 📊 即時氣象概況表\n\n`;
  md += `| 城市 | 天氣狀況 | 目前氣溫 | 體感溫度 | 相對濕度 | 風速 (km/h) | 紫外線 (UV) |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const item of weatherList) {
    const icon = getWeatherIcon(item.desc);
    md += `| **${item.name}** | ${icon} ${item.desc} | **${item.tempC}°C** | ${item.feelsLikeC}°C | ${item.humidity}% | ${item.windSpeed} | ${item.uvIndex} |\n`;
  }

  md += `\n---\n`;
  md += `### 💡 自動化流程說明\n`;
  md += `1. **CI 觸發器**：支援排程排定（Scheduled Trigger）與程式碼推送觸發。\n`;
  md += `2. **數據來源**：全球氣象開放 API。\n`;
  md += `3. **發布目標**：透過 Azure DevOps Wiki REST API 即時更新專案 Wiki 文件。\n`;

  return md;
}

/**
 * 更新 Azure DevOps Wiki 頁面
 */
async function updateWikiPage(content) {
  const pageApiUrl = `https://dev.azure.com/${ORG}/${PROJECT}/_apis/wiki/wikis/${WIKI_ID}/pages?path=${encodeURIComponent(PAGE_PATH)}&api-version=7.0`;

  // 1. 先取得現有頁面的 ETag (如果有)
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

  // 2. 呼叫 PUT 更新頁面
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
          console.log(`Wiki 頁面更新成功！HTTP 狀態碼: ${res.statusCode}`);
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
 * 主執行函式
 */
async function main() {
  console.log('開始蒐集世界各大城市即時天氣資料...');
  const weatherList = [];
  for (const city of CITIES) {
    console.log(`正在取得 ${city.name} 天氣...`);
    const weather = await getCityWeather(city);
    weatherList.push(weather);
  }

  console.log('所有天氣資訊取得完成，產生 Markdown 內容...');
  const mdContent = buildMarkdownContent(weatherList);

  console.log('正在推送更新至 Azure DevOps Wiki...');
  await updateWikiPage(mdContent);
  console.log('世界天氣 Wiki 自動化更新流程完成！');
}

main().catch(err => {
  console.error('執行過程發生錯誤:', err);
  process.exit(1);
});
