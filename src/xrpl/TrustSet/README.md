# TrustSet

XRPLでIOUのTrustLineを設定するスクリプト集です。
IOU受取の前提条件となる信頼線を設定できます。

- **TrustLine設定**: 指定されたIOUの信頼線を設定
- **信頼限度額**: 受取可能な最大金額を設定
- **通貨コード**: 3文字の通貨コード（例: ABC, USD）

**前提条件**: ユーザーアカウントに十分な準備金（約5 XRP）が必要
**注意**: 一度設定したTrustLineは削除できません（限度額を0に設定可能）

## 🎯 シナリオ実行コマンドと説明

### 1. TrustLine設定
```bash
npx tsx src/xrpl/TrustSet/trustSet.ts
```
Userアカウントが指定されたIOUのTrustLineを設定（信頼限度額: 1,000,000）

## ✅ 予想される結果

**成功時:**
- `trustSet.ts`実行 → UserウォレットにTrustLineが設定される
- ExplorerでtesSUCCESS確認可能
- その後、該当IOUの受取が可能になる

**失敗時:**
- 準備金不足の場合 → `tecUNFUNDED_PAYMENT`エラー
- 無効な通貨コードの場合 → `temBAD_CURRENCY`エラー
- 無効なフラグ設定の場合 → `temINVALID_FLAG`エラー

## 🔍 参考文献
- [XRP LEDGER - TrustSet](https://xrpl.org/ja/docs/references/protocol/transactions/types/trustset)
- [xrpl.js - TrustSet](https://js.xrpl.org/interfaces/TrustSet.html)
