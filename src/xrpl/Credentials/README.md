# Credentials

XRPLで資格情報（Credentials）を管理するスクリプト集です。
アカウント間で信頼できる資格情報を発行、受け入れ、削除できます。

- **CredentialCreate**: 資格情報を作成して対象アカウントに発行
- **CredentialAccept**: 発行された資格情報を受け入れる
- **CredentialDelete**: 資格情報を削除（発行者または受領者が実行可能）

**前提条件**: 発行者または受領者の両方が十分な準備金を持っている必要があります

## 🎯 シナリオ実行コマンドと説明

### 1. Credential作成
```bash
npx tsx src/xrpl/Credentials/credentialCreate.ts
```
Issuer（発行者）がUser（受領者）に対して資格情報を作成します。
CredentialTypeはHEX形式で指定し、有効期限（Expiration）をオプションで設定できます。

### 2. Credential受け入れ
```bash
npx tsx src/xrpl/Credentials/credentialAccept.ts
```
User（受領者）がIssuer（発行者）から発行された資格情報を受け入れます。
受け入れることで、その資格情報がアクティブになります。

### 3. Credential削除
```bash
npx tsx src/xrpl/Credentials/credentialDelete.ts
```
Issuer（発行者）またはUser（受領者）が既存の資格情報を削除します。
発行者と受領者の両方が削除する権限を持ちます。

## 🔄 実行順序

完全なフローをテストする場合は、以下の順序で実行してください：

1. `credentialCreate.ts` - 発行者が資格情報を作成
2. `credentialAccept.ts` - 受領者が資格情報を受け入れ
3. `credentialDelete.ts` - 発行者または受領者が資格情報を削除

## ✅ 予想される結果

**成功時:**
- `credentialCreate.ts`実行 → Issuerから指定されたSubjectに資格情報が作成される
- `credentialAccept.ts`実行 → Subjectが資格情報を正式に受け入れ、アクティブになる
- `credentialDelete.ts`実行 → 指定された資格情報が削除される
- 各トランザクションでExplorerでtesSUCCESS確認可能

**失敗時（CredentialCreate）:**
- `tecDUPLICATE` - 同じSubject、Issuer、およびCredentialTypeを持つCredentialがすでに存在
- `tecEXPIRED` - Credentialの有効期限に過去の日時が設定されている
- `tecNO_TARGET` - Subjectフィールドで指定されたアカウントがレジャーで資金提供されていない
- `temINVALID_ACCOUNT_ID` - 提供されたSubjectフィールドが無効

**失敗時（CredentialAccept）:**
- `tecDUPLICATE` - 指定された資格情報は既に承認されている
- `tecEXPIRED` - 指定された資格情報の有効期限が過去の時点になっている
- `tecNO_ENTRY` - 指定された資格情報がレジャー上に存在しない
- `temINVALID_ACCOUNT_ID` - 提供されたIssuerフィールドが無効

**失敗時（CredentialDelete）:**
- `tecNO_ENTRY` - 削除しようとしているCredentialがレジャー上に存在しない
- `temINVALID_ACCOUNT_ID` - 提供されたアカウントフィールドが無効

**共通の失敗ケース:**
- `.env`不足またはノード接続失敗 → 実行不可

## 🔍 参考文献
- [XRP LEDGER - Credentials](https://xrpl.org/ja/docs/references/protocol/transactions/types/credentialcreate)
- [XRP LEDGER - CredentialCreate](https://xrpl.org/ja/docs/references/protocol/transactions/types/credentialcreate)
- [XRP LEDGER - CredentialAccept](https://xrpl.org/ja/docs/references/protocol/transactions/types/credentialaccept)
- [XRP LEDGER - CredentialDelete](https://xrpl.org/ja/docs/references/protocol/transactions/types/credentialdelete)
- [xrpl.js - Documentation](https://js.xrpl.org/)
