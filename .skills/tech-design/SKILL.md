---
name: tech-design
description: Java Spring Boot 技術規格與架構設計規範 (Design Phase Skill)。負責將 PBI 驗收標準轉化為 Technical Design RFC，並發布至 Azure Wiki。
---

# Java Spring Boot 架構設計規範 (Design Phase Skill)

本規範定義 AI 作為「Spring Boot 解決方案架構師 (Solution Architect Agent)」時，如何依據 PBI 的 Acceptance Criteria 產出標準的 Technical Design RFC，並同步至 Azure DevOps Wiki。

## 設計文件結構標準（Azure Wiki 頁面模板）

每份產出到 Azure Wiki 的設計文件必須包含以下章節：

```markdown
# [RFC] PBI #{PBI_ID} - {PBI_TITLE} 技術設計規格書

* **關聯 PBI**：[#{PBI_ID}](https://dev.azure.com/wmwangf/SDLC/_workitems/edit/{PBI_ID})
* **目標技術棧**：Java 17+ / Spring Boot 3.x / Spring Data JPA / Maven
* **設計日期**：{YYYY-MM-DD}
* **狀態**：等待審查 (Pending Review) / 已核准 (Approved)

---

## 1. 背景與功能目標 (Context & Goals)
簡述本次功能實作的業務背景、欲達成的目標以及非目標（Non-goals）。

## 2. API 端點契約 (API Specification)
以 OpenAPI / RESTful 風格定義所有新開或異動的端點：
* **HTTP Method & Path**: e.g., `POST /api/v1/orders`
* **Request DTO (JSON 範例與型態定義)**
* **Response DTO (成功與失敗範例)**
* **HTTP 狀態碼對應表** (200, 201, 400, 404, 409, 500)

## 3. 資料庫設計與 Entity 關聯 (Data Model & Schema)
* **實體類別定義 (JPA Entity)**：定義資料表名稱、欄位型態、主鍵策略、索引規劃、Auditing 欄位（`createdAt`, `updatedAt`）。
* **實體關聯圖 (ERD / Mermaid)**。

## 4. 業務邏輯與循序圖 (Sequence Diagram)
使用 Mermaid 循序圖描繪 Controller -> Service -> Repository -> External Service 的互動時序與交易邊界（`@Transactional`）。

## 5. 例外處理與防呆機制 (Error Handling)
* 定義專屬的業務例外類別（例如 `OrderNotFoundException`）。
* 整合 `@RestControllerAdvice` 產出標準化的 `ProblemDetails` 或團隊自訂錯誤結構。

## 6. 單元測試計畫 (Test Strategy)
列出對應 PBI Acceptance Criteria 的測試案例規劃，明確指定測試類別名稱與驗證重點（Controller MockMvc 測試、Service Mockito 測試）。
```

## 架構原則檢核
在產出規格時，必須嚴格遵守以下標準：
1. **分層單向依賴**：Controller 呼叫 Service，Service 呼叫 Repository，嚴禁 Controller 直接操作 Repository。
2. **DTO 隔離**：Controller 層與外部通訊一律使用 Request/Response DTO，嚴禁將 JPA Entity 直接曝露給前端。
3. **無狀態設計 (Stateless)**：Service 必須維持無狀態，以便橫向擴展。
