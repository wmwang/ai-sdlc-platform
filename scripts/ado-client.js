/**
 * Azure DevOps REST API 統一客戶端
 * 支援 Boards (Work Items / Comments)、Wiki、Repos (Pull Requests)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class AdoClient {
  constructor(configPath = path.join(__dirname, '../ado-sdlc.config.json')) {
    this.loadConfig(configPath);
  }

  loadConfig(configPath) {
    let fileConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.warn(`[WARN] 無法解析設定檔 ${configPath}，採用預設值。`);
      }
    }

    this.orgUrl = process.env.ADO_ORG_URL || (fileConfig.projectInfo && fileConfig.projectInfo.organizationUrl) || 'https://dev.azure.com/wmwangf';
    this.project = process.env.ADO_PROJECT || (fileConfig.projectInfo && fileConfig.projectInfo.projectName) || 'SDLC';
    this.repo = process.env.ADO_REPO || (fileConfig.projectInfo && fileConfig.projectInfo.repositoryName) || 'SDLC';
    this.wikiId = process.env.ADO_WIKI_ID || (fileConfig.wiki && fileConfig.wiki.wikiIdentifier) || '09b02d2c-b627-4083-b978-5ac54de52d34';
    this.config = fileConfig;

    this.token = process.env.ADO_PAT || process.env.SYSTEM_ACCESSTOKEN || 'REMOVED_TOKEN';
    this.authHeader = this.getAuthHeader(this.token);
  }

  getAuthHeader(token) {
    if (!token) return '';
    if (token.split('.').length === 3) {
      return 'Bearer ' + token;
    }
    return 'Basic ' + Buffer.from(':' + token).toString('base64');
  }

  /**
   * 通用 HTTP 請求封裝
   */
  request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const headers = {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

      const reqOptions = {
        method: options.method || 'GET',
        headers
      };

      const req = https.request(url, reqOptions, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const status = res.statusCode;
          let parsed;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch (e) {
            parsed = body;
          }

          if (status >= 200 && status < 300) {
            resolve({ status, data: parsed, headers: res.headers });
          } else {
            reject({ status, data: parsed, message: `HTTP ${status}: ${typeof parsed === 'object' ? JSON.stringify(parsed) : parsed}` });
          }
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  // ==========================================
  // 1. Azure Boards (Work Items / PBI)
  // ==========================================

  /**
   * 建立新的 Work Item (例如 Product Backlog Item)
   */
  async createWorkItem(type = 'Product Backlog Item', fieldsMap = {}) {
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wit/workitems/$${encodeURIComponent(type)}?api-version=7.1-preview.3`;
    const patchDocument = [];

    for (const [key, value] of Object.entries(fieldsMap)) {
      patchDocument.push({
        op: 'add',
        path: `/fields/${key}`,
        value: value
      });
    }

    const res = await this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-patch+json'
      },
      body: patchDocument
    });
    return res.data;
  }

  /**
   * 取得指定 Work Item (PBI) 完整資料
   */
  async getWorkItem(id) {
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wit/workitems/${id}?$expand=all&api-version=7.1-preview.3`;
    const res = await this.request(url);
    return res.data;
  }

  /**
   * 更新 Work Item 欄位 (JSON Patch)，具備 409 樂觀鎖衝突自動重試機制
   * fieldsMap: { "System.Title": "...", "Microsoft.VSTS.Common.AcceptanceCriteria": "..." }
   */
  async updateWorkItem(id, fieldsMap = {}, maxRetries = 3) {
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wit/workitems/${id}?api-version=7.1-preview.3`;
    const patchDocument = [];

    for (const [key, value] of Object.entries(fieldsMap)) {
      // 在 Azure DevOps 中，System.Tags 若使用 add 會變成 append，必須使用 replace 才能覆蓋
      patchDocument.push({
        op: (key === 'System.Tags') ? 'replace' : 'add',
        path: `/fields/${key}`,
        value: value
      });
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await this.request(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json-patch+json'
          },
          body: patchDocument
        });
        return res.data;
      } catch (err) {
        if (attempt < maxRetries && err && (err.status === 409 || (err.message && err.message.includes('TF26071')))) {
          console.warn(`[AI-SDLC WARN] 遭遇 WorkItemRevisionMismatchException (409)，等待 1.5 秒後重試 (${attempt}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * 在 Work Item 討論區新增留言
   */
  async addWorkItemComment(id, commentText) {
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.3`;
    const res = await this.request(url, {
      method: 'POST',
      body: { text: commentText }
    });
    return res.data;
  }

  /**
   * 取得 Work Item 討論區歷史留言
   */
  async getWorkItemComments(id) {
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.3`;
    const res = await this.request(url);
    return res.data.comments || [];
  }

  // ==========================================
  // 2. Azure Wiki
  // ==========================================

  /**
   * 新增或更新 Wiki 頁面 (Markdown)，支援自動遞迴建立父目錄頁面
   */
  async upsertWikiPage(pagePath, content, comment = 'Update via AI SDLC') {
    const cleanPath = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
    const segments = cleanPath.split('/').filter(Boolean);

    // 若有父目錄 (例如 /Designs/PBI-1...)，先確認父頁面是否存在
    if (segments.length > 1) {
      const parentPath = '/' + segments.slice(0, -1).join('/');
      try {
        const parentGetUrl = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wiki/wikis/${encodeURIComponent(this.wikiId)}/pages?path=${encodeURIComponent(parentPath)}&api-version=7.0`;
        await this.request(parentGetUrl);
      } catch (e) {
        // 父目錄不存在，自動建立父目錄頁面
        const parentTitle = segments[segments.length - 2];
        const parentContent = `# 📁 ${parentTitle} 規格文件目錄\n\n本目錄由 AI SDLC 自動建立，收錄相關的架構設計文件與規格書。\n`;
        await this.upsertWikiPage(parentPath, parentContent, `Auto-create parent directory ${parentPath}`);
      }
    }

    let eTag = null;
    const getUrl = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wiki/wikis/${encodeURIComponent(this.wikiId)}/pages?path=${encodeURIComponent(cleanPath)}&includeContent=true&api-version=7.0`;

    try {
      const existing = await this.request(getUrl);
      if (existing.headers && existing.headers.etag) {
        eTag = existing.headers.etag;
      }
    } catch (e) {
      // 頁面不存在，新建時不需 If-Match
    }

    const putHeaders = {};
    if (eTag) {
      putHeaders['If-Match'] = eTag;
    }

    const putUrl = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wiki/wikis/${encodeURIComponent(this.wikiId)}/pages?path=${encodeURIComponent(cleanPath)}&comment=${encodeURIComponent(comment)}&api-version=7.0`;
    const res = await this.request(putUrl, {
      method: 'PUT',
      headers: putHeaders,
      body: { content }
    });
    return res.data;
  }

  // ==========================================
  // 3. Azure Repos & Pull Requests
  // ==========================================

  /**
   * 建立 Pull Request 並關聯 Work Item
   */
  async createPullRequest({ sourceBranch, targetBranch = 'main', title, description, workItemId }) {
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/git/repositories/${encodeURIComponent(this.repo)}/pullrequests?api-version=7.1-preview.1`;

    // 格式化分支名稱 (refs/heads/...)
    const sourceRef = sourceBranch.startsWith('refs/heads/') ? sourceBranch : `refs/heads/${sourceBranch}`;
    const targetRef = targetBranch.startsWith('refs/heads/') ? targetBranch : `refs/heads/${targetBranch}`;

    const body = {
      sourceRefName: sourceRef,
      targetRefName: targetRef,
      title: title,
      description: description
    };

    if (workItemId) {
      body.workItemRefs = [
        {
          id: workItemId.toString(),
          url: `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wit/workitems/${workItemId}`
        }
      ];
    }

    const res = await this.request(url, {
      method: 'POST',
      body
    });
    return res.data;
  }

  /**
   * 取得指定 Pull Request 資訊 (用以檢查是否已 completed / abandoned)
   */
  async getPullRequest(prId) {
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/git/repositories/${encodeURIComponent(this.repo)}/pullrequests/${prId}?api-version=7.1-preview.1`;
    const res = await this.request(url);
    return res.data;
  }

  /**
   * 執行 WIQL 查詢工作項目
   */
  async queryWorkItemsByWiql(query) {
    const url = `${this.orgUrl}/${encodeURIComponent(this.project)}/_apis/wit/wiql?api-version=7.1-preview.2`;
    const res = await this.request(url, {
      method: 'POST',
      body: { query }
    });
    return res.data.workItems || [];
  }
}

module.exports = AdoClient;
