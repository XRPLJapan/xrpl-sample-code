# AccountSet（アカウント設定）

XRP Ledgerの`AccountSet`トランザクションを使用して、アカウントの各種設定やフラグを管理するサンプルコードです。

## 📋 概要

`AccountSet`トランザクションは、XRPLアカウントの設定を変更するために使用されます。以下のような設定が可能です：

- アカウントフラグの有効化/無効化
- 送金手数料の設定（`TransferRate`）
- ドメインやメールハッシュの設定
- NFTokenのミンターアカウント設定
- その他のアカウントプロパティの変更

## 🚀 実行方法

### 1. TrustLine Lockingの有効化

```bash
npx tsx src/xrpl/AccountSet/enableTrustLineLocking.ts
```

**機能:**
- IOU発行者アカウントに`lsfAllowTrustLineLocking`フラグを設定
- 発行したIOUトークンをエスクローで使用可能にする
- `AccountSet`トランザクションで`asfAllowTrustLineLocking` (17)を設定

**前提条件:**
- 発行者アカウントで実行する必要がある
- TokenEscrow Amendmentが有効化されている

**予想される結果:**
- アカウントに`lsfAllowTrustLineLocking` (0x40000000)フラグが設定される
- 発行したIOUトークンがエスクローで使用可能になる

**注意:**
- このフラグが設定されていない場合、IOUエスクローは`tecNO_PERMISSION`で失敗
- MPTの場合は、`MPTokenIssuance`の`tfMPTCanEscrow`フラグを使用（このスクリプトは不要）

## 📚 主要なAccountSetフラグ

### アカウントフラグ一覧

| フラグ名 | 値 | 説明 |
|---------|-----|------|
| `asfRequireDest` | 1 | 宛先タグを必須にする |
| `asfRequireAuth` | 2 | TrustLineに認証を要求する |
| `asfDisallowXRP` | 3 | XRPの受け取りを禁止する |
| `asfDisableMaster` | 4 | マスターキーを無効化する |
| `asfAccountTxnID` | 5 | AccountTxnIDトラッキングを有効化 |
| `asfNoFreeze` | 6 | Global Freezeを永久に無効化する |
| `asfGlobalFreeze` | 7 | すべてのトークンを凍結する |
| `asfDefaultRipple` | 8 | デフォルトでRipplingを有効化 |
| `asfDepositAuth` | 9 | Deposit Authorizationを有効化 |
| `asfAuthorizedNFTokenMinter` | 10 | NFTokenミンターを認証 |
| `asfDisallowIncomingNFTokenOffer` | 12 | NFTokenオファーの受信を禁止 |
| `asfDisallowIncomingCheck` | 13 | Checkの受信を禁止 |
| `asfDisallowIncomingPayChan` | 14 | Payment Channelの受信を禁止 |
| `asfDisallowIncomingTrustline` | 15 | TrustLineの受信を禁止 |
| `asfAllowTrustLineClawback` | 16 | TrustLine Clawbackを許可 |
| **`asfAllowTrustLineLocking`** | **17** | **TrustLine Lockingを許可（エスクロー用）** |

## 🔐 TrustLine Lockingフラグの詳細

### lsfAllowTrustLineLocking (0x40000000)

**目的:**
- IOU発行者が発行したトークンをエスクローで保持可能にする
- XLS-0085（TokenEscrow Amendment）で導入

**設定方法:**
```typescript
const accountSet: AccountSet = {
  TransactionType: 'AccountSet',
  Account: issuerAddress,
  SetFlag: 17, // asfAllowTrustLineLocking
};
```

**要件:**
- ✅ TokenEscrow Amendmentが有効化されている
- ✅ 発行者アカウントのみが設定可能
- ✅ 一度有効化すると、保有者はこのトークンでエスクローを作成可能

**エラー:**
- `tecNO_PERMISSION`: 発行者以外が実行しようとした
- `tecINVALID_FLAG`: 無効なフラグ値
- `temDISABLED`: TokenEscrow Amendmentが無効

**関連:**
- [XLS-0085: TokenEscrow Amendment](https://xls.xrpl.org/xls/XLS-0085-token-escrow.html)
- [Escrow機能](../Escrow/README.md)

## 💡 使用例とユースケース

### 1. IOU Escrowの有効化
- **用途**: IOU発行者がトークンエスクローを許可
- **例**: ステーブルコイン発行者が、ユーザーがトークンをエスクローで保持できるようにする

### 2. アカウントセキュリティ設定
- **用途**: アカウントのセキュリティを強化
- **例**: `asfRequireDest`で宛先タグを必須にする、`asfDisableMaster`でマスターキーを無効化

### 3. トークン発行設定
- **用途**: トークン発行者の設定を管理
- **例**: `asfRequireAuth`で認証を必須にする、`asfNoFreeze`で凍結機能を放棄

## ⚠️ 注意事項

1. **不可逆な設定**: 
   - `asfNoFreeze`は一度設定すると元に戻せない
   - マスターキー無効化（`asfDisableMaster`）は慎重に行う必要がある

2. **発行者限定の設定**:
   - `asfAllowTrustLineLocking`は発行者のみが設定可能
   - トークン保有者が設定しようとすると`tecNO_PERMISSION`エラー

3. **Amendment依存**:
   - 一部のフラグは特定のAmendmentが有効化されている必要がある
   - `asfAllowTrustLineLocking`はTokenEscrow Amendmentが必要

4. **フラグの相互作用**:
   - 一部のフラグは他のフラグと相互作用する
   - 設定前に影響を確認することを推奨

## 🔍 エラーコード

| エラーコード | 説明 | 対処法 |
|-------------|------|--------|
| `tecNO_PERMISSION` | 権限なし | 発行者アカウントで実行する |
| `tecINVALID_FLAG` | 無効なフラグ | 正しいフラグ値（17）を指定 |
| `temDISABLED` | Amendmentが無効 | TokenEscrow Amendmentが有効か確認 |
| `temINVALID_FLAG` | 無効なフラグ設定 | SetFlagまたはClearFlagを正しく指定 |
| `tecNO_ALTERNATIVE_KEY` | 代替キーなし | マスターキー無効化前に署名キーを設定 |

## 📚 参考文献

### 公式ドキュメント
- [AccountSet Transaction](https://xrpl.org/ja/docs/references/protocol/transactions/types/accountset)
- [AccountRoot Object](https://xrpl.org/ja/docs/references/protocol/ledger-data/ledger-entry-types/accountroot)
- [Account Flags](https://xrpl.org/ja/docs/references/protocol/ledger-data/ledger-entry-types/accountroot#accountroot-flags)

### 関連仕様
- [XLS-0085: TokenEscrow Amendment](https://xls.xrpl.org/xls/XLS-0085-token-escrow.html)
- [Escrow機能](../Escrow/README.md)
