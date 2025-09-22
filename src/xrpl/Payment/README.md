# Payment

XRPLでアカウント間の資産転送を実行するスクリプト集です。
送金資産はXRP（drops単位の文字列）またはIOU（CurrencyAmountオブジェクト）で指定できます。

- **XRP送金**: `Amount: "1000"` (drops)
- **IOU送金**: `Amount: { currency, issuer, value }`

**前提条件（IOU）**: 受信者が該当IOUのTrustLineを保有している必要があります
**RequireAuth有効時**: 受信者は必ず承認（allow trust）状態でなければ受取不可

## 🎯 シナリオ実行コマンドと説明

### 1. XRP送金
```bash
npx tsx src/xrpl/Payment/sendXRP.ts
```
AdminアカウントがUserアカウントにXRPを送金（Amountはdrops単位の文字列、例: "1000" = 0.001 XRP）

### 2. IOU送金
```bash
npx tsx src/xrpl/Payment/sendIOU.ts
```
Admin（発行者）アカウントがUserアカウントにIOUを送金
Amountは`{ currency, issuer, value }`形式で、Userは該当IOUのTrustLineを必ず保有している必要があります

## ✅ 予想される結果

**成功時:**
- `sendXRP.ts`実行 → Userウォレットに指定した数量のXRPが到着
- `sendIOU.ts`実行 → Userウォレットに指定したIOUが到着、ExplorerでtesSUCCESS確認可能

**失敗時:**
- UserがIOU信頼線を保有していない場合 → `tecNO_LINE` / `tecNO_AUTH`エラー
- 発行者アカウントがRequireAuth設定時、承認されていないアカウント → 受取失敗
- `.env`不足またはノード接続失敗 → 実行不可

## 🔍 参考文献
- [XRP LEDGER - Payment](https://xrpl.org/ja/docs/references/protocol/transactions/types/payment)
- [xrpl.js - Payment](https://js.xrpl.org/interfaces/Payment.html)
