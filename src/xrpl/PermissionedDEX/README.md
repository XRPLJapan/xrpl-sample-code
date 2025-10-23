# Permissioned DEX

XRPLのPermissioned DEX（許可型分散取引所）を利用したオファー作成のサンプルコード集です。
Permissioned DEXにより、規制された企業がコンプライアンスに準拠しながらXRPL上で取引できます。

**注意:** 現在、Mainnet/TestnetではPermissionedDEX Amendmentは有効になっていません。

- **Open Offer**: 従来のオープンDEXでのオファー作成（誰でもアクセス可能）
- **Permissioned Offer**: 特定のドメインID内でのみ取引可能なオファー
- **Hybrid Offer**: ドメインIDとオープンDEXの両方で取引可能なオファー

**前提条件**: 
- パーミッションオファーおよびハイブリッドオファーを作成するには、事前にPermissioned Domainを作成し、Domain IDを取得する必要があります
- アカウントは指定されたドメインへのアクセス権（適切なCredential）を持っている必要があります
- 通貨ペアの取引には、必要なトラストラインが設定されている必要があります

## 📖 概要

Permissioned DEXは、XRP Ledger上の分散型取引所（DEX）の管理された取引環境です。従来のオープンなDEXに加え、許可型ドメインによってアクセス制御されたDEXで取引できます。

### 主な特徴

1. **オープンオファー**: 従来通り、誰でもアクセス可能なDEXでの取引
2. **パーミッションオファー**: 特定のドメインIDを持つDEX内でのみマッチング可能
3. **ハイブリッドオファー**: 指定ドメインとオープンDEXの両方でマッチング可能
4. **柔軟なアクセス制御**: Credentialsによる適切な認証が必要

### オファータイプの比較

| オファー/支払い種別 | オープンオファー | ハイブリッドオファー | パーミッションオファー | AMM |
| ------------------ | -------------- | -------------------- | -------------------- | --- |
| オープン           | ✅              | ✅                    | ❌                    | ✅   |
| ハイブリッド       | ✅              | ✅                    | ✅ (同一ドメイン)      | ✅   |
| パーミッション     | ❌              | ❌                    | ✅ (同一ドメイン)      | ❌   |

### オファータイプの説明

#### オープンオファー
- DomainIDを指定しない従来のオファー
- 誰でもマッチング可能
- オープンDEXのオーダーブックに配置される
- AMMとも相互作用可能

#### パーミッションオファー
- DomainIDを指定（特別なフラグは不要）
- 同じDomainIDを持つパーミッションオファーとのみマッチング
- ドメイン固有のオーダーブックに配置される
- AMMとは相互作用しない
- アカウントは適切なCredentialを持っている必要がある

#### ハイブリッドオファー
- DomainIDを指定し、`tfHybrid`フラグを設定
- パーミッションDEXとオープンDEXの両方でマッチング可能
- 両方のオーダーブックに配置される
- 作成時はパーミッションDEXのオファーと優先的にマッチング
- AMMとも相互作用可能

### 無効なオファー

パーミッションオファーは、以下の場合に無効となります：
- アカウントが保有するCredentialが期限切れまたは削除された
- ドメインの承認済みCredentialsリストが更新され、アカウントが新しいCredentialを保有していない
- ドメインが削除された

無効なオファーは、資金不足のオファーと同様に扱われ、オーダーブックが変更される際に自動的に削除されます。

## 🚀 実行方法

### 前提条件の準備

パーミッションオファーまたはハイブリッドオファーを作成する前に、以下を実行してください：

```bash
# 1. Permissioned Domainを作成
npx tsx src/xrpl/PermissionedDomains/permissionedDomainSet.ts

# 出力されたDomain IDをメモしてください

# 2. Credentialを作成（必要に応じて）
npx tsx src/xrpl/Credentials/credentialCreate.ts

# 3. Credentialを承認
npx tsx src/xrpl/Credentials/credentialAccept.ts

# 4. トラストラインを設定（IOU取引の場合）
npx tsx src/xrpl/TrustSet/trustSet.ts

# 4-1. ドメインメンバーではないアカウントのトラストラインを設定（OUTSIDER_SEEDを使用する場合）
npx tsx src/xrpl/TrustSet/trustSetOutsider.ts

# 5. IOUを発行
npx tsx src/xrpl/Payment/sendIOU.ts

# 5-1. ドメインメンバーではないアカウントへIOUを送金（任意）
npx tsx src/xrpl/Payment/sendIOUOutsider.ts
```

### 1. オープンオファーの作成

従来のオープンDEXでオファーを作成します。

```bash
npx tsx src/xrpl/PermissionedDEX/openOffer.ts
```

このスクリプトは：
- DomainIDを指定せずにオファーを作成
- オープンDEXのオーダーブックに配置
- 誰でもマッチング可能なオファーを作成

### 2. パーミッションオファーの作成

特定のドメインID内でのみ取引可能なオファーを作成します。

```bash
npx tsx src/xrpl/PermissionedDEX/permissionedOffer.ts
```

**重要:** 実行前に`permissionedDomainSet.ts`で取得したDomain IDを、`.env`ファイルの`DOMAIN_ID`に設定してください。

このスクリプトは：
- 指定されたDomainIDを持つオファーを作成
- DomainIDを指定するだけでパーミッションオファーになります
- 同じドメインIDのパーミッションオファーとのみマッチング

### 3. ハイブリッドオファーの作成

パーミッションDEXとオープンDEXの両方で取引可能なオファーを作成します。

```bash
npx tsx src/xrpl/PermissionedDEX/hybridOffer.ts
```

**重要:** 実行前に`permissionedDomainSet.ts`で取得したDomain IDを、`.env`ファイルの`DOMAIN_ID`に設定してください。

このスクリプトは：
- 指定されたDomainIDを持つオファーを作成
- DomainIDと`tfHybrid`フラグを設定
- パーミッションDEXとオープンDEXの両方でマッチング可能
- 作成時はパーミッションDEXのオファーと優先的にマッチング

### 4. ドメインメンバーではないアカウントによるオファーの作成

ドメインメンバーではないアカウント（外部者）がオファーを作成し、Permissioned DEXの挙動を確認します。

```bash
npx tsx src/xrpl/PermissionedDEX/outsiderOffer.ts
```

**重要:** 実行前に`.env`ファイルに`OUTSIDER_SEED`を設定してください。このアカウントはドメインメンバーではありません。

このスクリプトは：
- ドメインメンバーではないアカウントがオープンオファーを作成
- DomainIDを指定しない通常のオファー
- オープンオファーやハイブリッドオファーとはマッチング可能
- パーミッションオファーとはマッチング不可（アクセス制御を確認可能）

## 🔄 実行順序

完全なフローをテストする場合は、以下の順序で実行してください：

```bash
# 1. 準備: Permissioned Domainを作成
npx tsx src/xrpl/PermissionedDomains/permissionedDomainSet.ts
# → Domain IDをメモ

# 2. 準備: Credentialを作成・承認（必要に応じて）
npx tsx src/xrpl/Credentials/credentialCreate.ts
npx tsx src/xrpl/Credentials/credentialAccept.ts

# 3. 準備: トラストラインを設定 & IOU送金
npx tsx src/xrpl/TrustSet/trustSet.ts
npx tsx src/xrpl/TrustSet/trustSetOutsider.ts  # OUTSIDER_SEEDを設定してください
npx tsx src/xrpl/Payment/sendIOU.ts
npx tsx src/xrpl/Payment/sendIOUOutsider.ts  # 任意

# 4. オープンオファーを作成
npx tsx src/xrpl/PermissionedDEX/openOffer.ts

# 5. ドメインメンバーではないアカウントによるオファーを作成
npx tsx src/xrpl/PermissionedDEX/outsiderOffer.ts
# → オープンオファーとマッチングすることを確認

# 6. ハイブリッドオファーを作成（Domain IDを設定後）
npx tsx src/xrpl/PermissionedDEX/hybridOffer.ts

# 7. 再度、ドメインメンバーではないアカウントによるオファーを作成
npx tsx src/xrpl/PermissionedDEX/outsiderOffer.ts
# → ハイブリッドオファーとマッチングすることを確認

# 8. パーミッションオファーを作成
npx tsx src/xrpl/PermissionedDEX/permissionedOffer.ts

# 9. 再度、ドメインメンバーではないアカウントによるオファーを作成
npx tsx src/xrpl/PermissionedDEX/outsiderOffer.ts
# → パーミッションオファーとマッチングしないことを確認
```

## ✅ 予想される結果

**成功時:**
- 各オファーが正常に作成される
- トランザクション結果が表示される
- Explorerでトランザクションを確認可能（tesSUCCESS）

**失敗時（共通）:**
- `tecUNFUNDED_OFFER` - オファーを実行するための残高が不足
- `tecNO_LINE` - 通貨のトラストラインが存在しない
- `tecINSUFF_RESERVE_OFFER` - オファーを作成するための準備金が不足

**失敗時（パーミッション/ハイブリッド専用）:**
- `tecNO_ENTRY` - 指定されたDomainIDが存在しない
- `tecNO_PERMISSION` - アカウントがドメインへのアクセス権を持っていない
- `temDISABLED` - PermissionedDEX amendmentが有効になっていない

## 👥 登場人物の説明

Permissioned DEXを理解するために、以下の3つのアカウントを使用します：

| アカウント | 環境変数 | 役割 | Credentialの有無 | 作成可能なオファー |
|---------|---------|------|---------------|--------------------|
| **Issuer（発行者）** | `ISUEER_SEED` | IOU通貨の発行者 | ドメインメンバー ✅ | オープン / パーミッション / ハイブリッド |
| **User（ユーザー）** | `USER_SEED` | ドメイン内のトレーダー | ドメインメンバー ✅ | オープン / パーミッション / ハイブリッド |
| **Outsider（外部者）** | `OUTSIDER_SEED` | ドメイン外のトレーダー | 非メンバー ❌ | オープンのみ |

### 準備手順

各アカウントで必要な準備：

#### Issuer & User（ドメインメンバー）
1. Permissioned Domainを作成（IssuerまたはUserのどちらか）
2. Credentialを作成・承認（ドメインアクセス用）
3. TrustLineを設定（IOU取引用）
4. IOUを送金（Userへ）

#### Outsider（外部者）
1. TrustLineを設定（IOU取引用）
2. IOUを受け取る（任意、オファー作成に必要な場合）

### オファーマッチングの例

#### パターン1: パーミッションオファー同士
```
User（ドメインメンバー）のパーミッションオファー
  ↓ マッチング可能 ✅
Issuer（ドメインメンバー）のパーミッションオファー
```

#### パターン2: パーミッションオファーとオープンオファー
```
User（ドメインメンバー）のパーミッションオファー
  ↓ マッチング不可 ❌
Outsider（非メンバー）のオープンオファー
```

#### パターン3: ハイブリッドオファーとオープンオファー
```
User（ドメインメンバー）のハイブリッドオファー
  ↓ マッチング可能 ✅
Outsider（非メンバー）のオープンオファー
```

## 💡 使用例とユースケース

### 規制遵守

規制された金融機関は、Permissioned DEXを使用して、適切に審査された取引相手とのみ取引できます：

```typescript
// 機関投資家用のドメインを作成
// 承認された資格情報: "AccreditedInvestor" issued by RegulatoryBody

// ハイブリッドオファーを使用
// - 同じ機関投資家ドメイン内の相手と取引可能
// - オープンDEXでも流動性にアクセス可能
```

### コンプライアンス要件のある取引

特定の地域や規制要件に準拠した取引環境を構築：

```typescript
// 地域限定のドメインを作成
// 承認された資格情報: "RegionA_KYC" issued by ComplianceProvider

// パーミッションオファーを使用
// - RegionA_KYCを持つユーザーのみと取引
// - 完全な取引履歴の監査が可能
```

## ⚠️ 制限事項

### AMM（自動マーケットメーカー）との非互換性
- 許可型支払いはAMMでは約定できません
- AMMへのアクセスは許可型ドメインで制限できません
- オープンDEXを使用する取引は、同一トランザクション内でハイブリッドオファーとAMMを使用できます

### 複数ドメインの非対応
- 各Permissioned DEXは独立しており、独自のオーダーブックとオファーを持ちます
- 単一のトランザクションで複数のPermissioned DEXで取引したり、流動性を集約することはできません
- ハイブリッドオファーは1つのPermissioned DEXとオープンDEXの組み合わせのみ使用可能

### セキュリティ考慮事項
- Permissioned DEXのセキュリティと公平性は、ドメイン所有者とCredential発行者に依存します
- Credential発行者は任意にCredentialを発行・取り消すことができます
- ドメイン所有者は承認済みCredentialsリストを変更してアクセスを任意に付与・拒否できます

## 🎯 Amendment要件

Permissioned DEXを使用するには、XRPLネットワークで以下のAmendmentが有効になっている必要があります。
- `PermissionedDEX` Amendment
- `PermissionedDomains` Amendment（PermissionedDEXはPermissionedDomainsに依存します）
- `Credentials` Amendment（PermissionedDomainsはCredentialsに依存します）

## 🔍 参考文献

- [XRPL - Permissioned DEXes (Concepts)](https://xrpl.org/ja/docs/concepts/tokens/decentralized-exchange/permissioned-dexes)
- [XRPL - OfferCreate Transaction](https://xrpl.org/ja/docs/references/protocol/transactions/types/offercreate)
- [XRPL - Permissioned Domains](https://xrpl.org/ja/docs/concepts/tokens/decentralized-exchange/permissioned-domains)
- [XRPL - Decentralized Exchange](https://xrpl.org/ja/docs/concepts/tokens/decentralized-exchange/)
- [XRPL - Credentials](https://xrpl.org/ja/docs/references/protocol/transactions/types/credentialcreate)
- [xrpl.js - Documentation](https://js.xrpl.org/interfaces/OfferCreate.html)