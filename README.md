# 🚀 企業級 AI SDLC 自動化調度平台 (AI SDLC Platform)

本倉庫為獨立的 **AI 軟體交付生命週期 (AI SDLC) 核心調度引擎**。  
與業務微服務應用程式庫（Application Repos）完全解耦，以**「內部開發者平台 (IDP)」**模式運作，統一為企業多個專案提供全自動 Scrum 推進。

---

## 🏗️ 核心架構與五階段階梯狀態機

```mermaid
flowchart LR
    Step1["階段 1：需求反詰 (20%)\n[1/5]-需求反詰(等回覆)"] --> Step2["階段 2：驗收確立 (40%)\n[2/5]-驗收確立(完成)"]
    Step2 --> Step3["階段 3：架構設計 (60%)\n[3/5]-架構審查(待核准)"]
    Step3 -->|"🛑 看板狀態拖曳至 Approved"| Step4["階段 4：代碼實作 (80%)\n[4/5]-代碼實作(待合併)"]
    Step4 -->|"PR Complete 合併"| Step5["階段 5：審查結案 (100%)\n[5/5]-審查結案(Done)"]
```

---

## 📦 目錄結構

```text
ai-sdlc-platform/
├── scripts/
│   ├── ado-client.js        # Azure DevOps REST API 統一客戶端 (支援 409 自動重試)
│   └── sdlc.js              # 核心狀態機調度大腦與定時巡邏引擎 (Poll Engine)
├── .skills/
│   └── spec-coder/          # Java Spring Boot 3 企業架構代碼生成規範手冊
├── .azure-pipelines/        # Azure Pipelines 定時排程 YAML
├── .gitlab-ci.yml           # GitLab CI 定時排程 YAML
├── ado-sdlc.config.json     # 全域專案資訊與 Scrum 標籤設定檔
└── package.json             # 模組設定檔
```

---

## ⚡ 使用方式 (CLI 指令)

```bash
# 1. 定時巡邏掃描所有活躍需求並自動推進
node scripts/sdlc.js poll

# 2. 指定外部業務程式庫目錄 (Multi-Repo 模式)
node scripts/sdlc.js poll --target-dir=/path/to/business-repo

# 3. 建立示範用 PBI
node scripts/sdlc.js create-pbi "需求標題" "業務描述"

# 4. 手動指定 PBI 推進單一階段
node scripts/sdlc.js intend <pbi-id>
node scripts/sdlc.js confirm-intend <pbi-id>
node scripts/sdlc.js design <pbi-id>
node scripts/sdlc.js implement <pbi-id>
```

---

## 🔒 企業資安與最佳實踐
1. **無 Webhook 限制**：採每 10 分鐘 Scheduled Polling 機制，資安友善。
2. **架構安全防線 (State Gate)**：Wiki 規格書產出後卡在 `[3/5]` 階段，必須由架構師於看板將卡片拖曳至 **Approved** 才會啟動代碼實作。
3. **單一開關標籤**：僅識別 **`ai-candidate`** 標籤，不誤傷團隊其他人工作業。
