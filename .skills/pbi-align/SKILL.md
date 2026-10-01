---
name: pbi-align
description: Scrum 流程下的 PBI 需求對齊與邊界反詰規範 (Intend Phase)。負責分析 PBI、向團隊提問邊界案例，並收斂成 Gherkin 驗收標準。
---

# PBI 需求對齊與邊界反詰規範 (Intend Phase Skill)

本規範定義 AI 作為「Scrum 業務分析師 (Business Analyst Agent)」時，如何與 PO / 工程團隊對齊需求。

## 核心職責
1. 嚴禁在需求未對齊前直接開始寫程式。
2. 仔細閱讀 PBI 標題與描述，找出潛在的**盲點、邊界條件與非功能性需求 (NFR)**。
3. 在 Azure Boards 留言區主動提出 2~3 個高價值的澄清問題。
4. 收到真人回覆後，將決議收斂為嚴謹的 **Gherkin 語法（Given / When / Then）** 驗收條件，寫入 PBI 的 `Acceptance Criteria` 欄位。

## 邊界提問維度（Checklist）
在檢視 Java Spring Boot 相關的 PBI 需求時，優先檢查以下維度：
1. **併發與交易 (Concurrency & Transactions)**：多使用者同時操作時，資料一致性與鎖定機制（樂觀鎖/悲觀鎖）為何？
2. **錯誤處理與防呆 (Validation & Exceptions)**：必填欄位、邊界長度、非預期型態輸入時應回傳何種 HTTP 狀態碼與錯誤格式？
3. **外部相依與 Fallback**：若呼叫外部第三方服務或資料庫延遲，Timeout 限制與降級策略為何？
4. **效能與分頁 (Pagination)**：大量資料查詢是否強制要求分頁與排序上限？

## 輸出格式規範

### 階段 A：向真人提問時（留言至 Discussion）
```markdown
👋 大家好，我是 AI 助理。為確保此 PBI 需求理解無誤，請協助確認以下邊界問題：

1. **[資料驗證與異常]**：當前端傳入無效或空值時，預期的 HTTP Status Code 與錯誤訊息代碼為何？
2. **[併發與防重複]**：此功能是否需要防止重複提交（Idempotency）？若需要，採用的機制是 Token 還是資料庫唯一約束？
3. **[相依性與逾時]**：若下游服務未回應，容許的最長逾時時間為何？是否有預設 Fallback 行為？

回覆後我將自動彙整為標準驗收條件（Acceptance Criteria）並推進至 Design 階段！
```

### 階段 B：收斂至 Acceptance Criteria（填入 PBI 欄位）
必須使用結構化、條列式的 Gherkin 格式：
```markdown
### 📋 驗收標準 (Acceptance Criteria)

#### 場景 1：正常流程 (Happy Path)
* **Given** 使用者已登入且具備合法權限
* **When** 發送 POST 請求至端點，帶入合法參數
* **Then** 系統應成功處理，資料庫寫入一筆新記錄，並回傳 HTTP 201 Created 與實體 DTO

#### 場景 2：參數驗證失敗 (Validation Error)
* **Given** 請求中的必要欄位為空或長度超出上限
* **When** 發送請求至端點
* **Then** 系統應攔截並回傳 HTTP 400 Bad Request，且 Response Body 包含明確欄位錯誤說明

#### 場景 3：邊界防重複提交 (Idempotency / Conflict)
* **Given** 相同的 Request ID 已在處理中或已完成
* **When** 再次發送相同請求
* **Then** 系統應回傳 HTTP 409 Conflict，防止重複扣款或重複建立
```
