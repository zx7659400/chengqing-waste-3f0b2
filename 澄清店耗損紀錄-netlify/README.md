# 澄清店耗損紀錄（Netlify 版）

夥伴開網址就能記錄耗損，資料存在 Netlify Blobs，所有人即時共用。

- `public/`：網頁（index.html、app.js）
- `netlify/functions/api.mjs`：後端 API
- `netlify/lib/items.mjs`：預設品項與成本（第一次開啟時使用；之後在「品項」分頁修改）
- `netlify.toml`：Netlify 設定

## 部署步驟

> 注意：**不能用拖放（Netlify Drop）部署**，拖放不會部署後端，資料會存不起來。請用下面任一種方式。

### 方式一：GitHub ＋ 一鍵部署連結（推薦，約 5 分鐘）

1. 開 https://github.com/new
   - Repository name 填 `chengqing-waste` → 按 **Create repository**。
2. 在新 repo 頁面點 **uploading an existing file**，把 zip 解壓後**資料夾裡面的所有檔案和資料夾**拖進去 → **Commit changes**。
3. 開這個連結（把 `你的帳號` 換成你的 GitHub 帳號）：
   `https://app.netlify.com/start/deploy?repository=https://github.com/你的帳號/chengqing-waste`
   - 用 GitHub 登入 Netlify → 畫面會請你填 **ADMIN_PASSWORD**（主管密碼）→ 按 **Deploy**。
4. 1–2 分鐘後 Netlify 會給你網址：`https://xxxx.netlify.app`，這個就是給夥伴開的網址。
5. 想換好記的網址：到 https://app.netlify.com/ → 點這個網站 → **Domain management** → 改成例如 `chengqing-waste`。

備用：步驟 3 的連結打不開，就到 https://app.netlify.com/start → 選 GitHub → 選 `chengqing-waste` → Deploy，部署完再到 **Project configuration → Environment variables** 加 `ADMIN_PASSWORD`，然後 **Deploys → Trigger deploy** 一次。

### 方式二：Netlify CLI（在自己電腦上）

```bash
cd 這個資料夾
npm install
npx netlify login
npx netlify init            # 建立新網站
npx netlify env:set ADMIN_PASSWORD 你的主管密碼
npx netlify deploy --prod
```

## 使用方式

- **記錄**：填記錄人 → 選上午／下午 → 點品項 → 填數量、選原因 → 記錄。蔬菜要填當天每斤價格。標「秤重」的品項輸入秤到的克數，金額 = 克數 ÷ 每份克數 × 每份成本（每份克數可在「品項」分頁設定）。
- **今日回報**：按「複製今日耗損回報」，貼到店裡群組。
- **本月**：本月耗損金額、品項排行、原因排行、每日金額。
- **品項**：輸入主管密碼解鎖後，可以改單價、新增或隱藏品項。

## 成本說明

成本取自「2026 漲價」表的主食成本，其中：

- 海鹽雞胸 1 份 75g：29.5 × 0.75 = 22.1
- 滑蛋 100g：10.5
- 五穀飯、紫米飯 1 份 170g：3.5
- 打拋豬 1 份 65g、薑汁燒肉 1 份 70g：照表上主食成本
- 滑蛋蝦主食 45g、滑蛋鮭魚主食 50g：照表上主食成本
- 高麗菜、空心菜、青江菜、尼龍白、油菜：記錄時輸入每斤價格

## 之後要修改怎麼辦

- **單價、品項**：不用改程式。到 App 的「品項」分頁輸入主管密碼，直接修改、新增或隱藏，馬上生效。
- **功能或畫面要改**：在 Claude 對話裡說要改什麼，並附上這份 zip（或 GitHub repo 裡的檔案）。改好後：
  - 用 GitHub 部署的：把改過的檔案上傳到 repo（Add file → Upload files，同名檔案會覆蓋），Netlify 會自動重新部署。
  - 用 CLI 部署的：在同一個資料夾執行 `npx netlify deploy --prod`。
- 網址不會變，已經記錄的耗損資料也不會不見。
