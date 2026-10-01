---
name: spec-coder
description: Java Spring Boot 3.x 規格導向實作與測試技能規範 (Implement Phase Skill)。專注於將 Wiki 設計規格與 PBI Acceptance Criteria 轉換為企業級高品質程式碼與 JUnit 5 測試。
---

# Java Spring Boot 規格導向實作與測試技能指南 (Implement Phase Skill)

本規範定義 AI 作為「Java Spring Boot 高級工程師與 QA 專家」時的編碼準則、設計模式與單元測試規範。任何代碼實作必須嚴格遵守以下準則。

---

## 一、核心原則：規格導向開發 (Spec-Driven Development)

1. **唯一真相來源 (Single Source of Truth)**：
   * 業務行為必須 100% 滿足 PBI 的 `Acceptance Criteria` (Given / When / Then)。
   * 資料結構、API 路徑與端點契約必須嚴格依照 Azure Wiki 上的 Technical Design RFC。
   * **嚴禁擅自擴大需求範圍 (No Scope Creep)**，未在規格書或 AC 內定義的功能不得自行添加。
2. **測試先行與完全覆蓋 (100% AC Coverage)**：
   * 每一條驗收標準（AC-1, AC-2, AC-3...）必須在測試代碼中有明確對應的測試案例。
   * 只有在所有單元測試通過的前提下，才允許提交並建立 Pull Request。

---

## 二、Spring Boot 3.x 架構分層與編碼技巧 (Coding Patterns)

### 1. 資料庫實體層 (JPA Entity Pattern)
* **主鍵與策略**：使用 `@Id` 與 `@GeneratedValue(strategy = GenerationType.IDENTITY)`。
* **唯一性約束與索引**：若涉及冪等性鍵（如 `requestId`、`transactionNo`），必須在 `@Table` 中定義唯一索引：
  ```java
  @Table(name = "tb_wallet_transaction", indexes = {
      @Index(name = "idx_request_id", columnList = "request_id", unique = true)
  })
  ```
* **併發安全與樂觀鎖**：涉及金融扣款、庫存扣減等併發場景，必須加入 `@Version` 欄位：
  ```java
  @Version
  private Integer version;
  ```
* **審計欄位**：包含 `createdAt` (不可更新) 與 `updatedAt`。

### 2. DTO 隔離與資料驗證 (DTO & Validation Pattern)
* **嚴禁洩露 Entity**：Controller 接收與回傳必須一律使用專屬的 Request/Response DTO。
* **參數防呆驗證**：使用 Jakarta Validation 註解：
  * `@NotBlank(message = "必要欄位不能為空")`
  * `@NotNull`
  * `@DecimalMin(value = "0.01", message = "金額必須大於 0")`
  * 在 Controller 方法參數加上 `@Valid`。

### 3. 業務服務層 (Service Layer & Transactions)
* **無狀態設計 (Stateless)**：Service 不得保存與個別請求相關的實例狀態。
* **交易邊界**：涉及資料庫寫入的操作必須宣告 `@Transactional`。
* **防重複處理與冪等性 (Idempotency Pattern)**：
  在執行業務邏輯前，必須先調用 Repository 檢查該 `requestId` 是否已存在：
  ```java
  if (repository.existsByRequestId(request.getRequestId())) {
      throw new IllegalStateException("重複的請求 ID (409 Conflict): " + request.getRequestId());
  }
  ```

### 4. 控制器層與統一例外處理 (Controller & Exception Handling)
* **RESTful 規範**：資源操作採標準 HTTP Verb（POST 新建資源回傳 `201 Created`；GET 回傳 `200 OK`）。
* **全局異常映射 (`@RestControllerAdvice`)**：
  * 攔截 `MethodArgumentNotValidException` ➔ 轉換為 HTTP 400 Bad Request。
  * 攔截 `IllegalArgumentException` ➔ 轉換為 HTTP 400 Bad Request。
  * 攔截 `IllegalStateException` (重複請求) ➔ 轉換為 HTTP 409 Conflict。
  * 格式採標準 RFC 7807 `ProblemDetails`。

---

## 三、單元測試規範 (JUnit 5 + Mockito Guidelines)

單元測試是驗收 PBI 的關鍵標準，必須遵守以下結構：

1. **命名與清晰標註**：
   * 測試類別命名為 `*Test.java`（例如 `WalletServiceTest.java`）。
   * 使用 `@DisplayName` 清楚標註對應的 AC 編號與業務情境：
     `@DisplayName("AC-1: 正常流程 (Happy Path) - 請求合法時成功持久化並回傳 DTO")`
2. **Given - When - Then 結構**：
   * **Arrange (Given)**：準備輸入物件、Mock 依賴項的預期行為。
   * **Act (When)**：執行被測試方法。
   * **Assert (Then)**：驗證回傳值（`assertEquals`, `assertNotNull`）並驗證 Mock 的調用次數（`verify(repo, times(1)).save(...)`）。
3. **異常情境驗證**：
   * 驗證防呆與邊界錯誤時，使用 `assertThrows`：
   ```java
   @Test
   @DisplayName("AC-2: 參數驗證失敗 - 當金額為空或負數時拋出例外")
   void should_throw_exception_when_amount_invalid() {
       assertThrows(IllegalArgumentException.class, () -> {
           walletService.processTransaction(invalidRequest);
       });
       verify(repository, never()).save(any());
   }
   ```

---

## 四、Pull Request 變更摘要規範

代碼產出且 `mvn test` 綠燈後，產出的 PR 描述必須符合以下範本：

```markdown
## 📌 變更摘要 (Summary)
依據 **PBI #{PBI_ID}** 與 Azure Wiki 設計規格書進行實作。

### 📋 驗收標準對照 (Acceptance Criteria Alignment)
- [x] **AC-1 正常流程實作** -> 通過 `WalletServiceTest.should_process_successfully_when_valid()`
- [x] **AC-2 參數驗證失敗** -> 通過 `WalletServiceTest.should_throw_exception_when_amount_invalid()`
- [x] **AC-3 邊界防重複扣款** -> 通過 `WalletServiceTest.should_throw_exception_when_duplicate_request()`

### 📐 架構設計符合度 (Wiki Compliance)
- [x] 符合分層規範（Controller / Service / Repository / Entity）
- [x] DTO 與 Entity 隔離，無狀態 API
- [x] 單元測試覆蓋率 100% (Tests run: 3, Failures: 0, Errors: 0)

關聯工作項目：AB#{PBI_ID}
```
