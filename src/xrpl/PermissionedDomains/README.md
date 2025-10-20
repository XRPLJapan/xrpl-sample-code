# Permissioned Domains

XRPLで許可型ドメインドメイン（Permissioned Domains）を管理するスクリプト集です。
ドメインを作成・削除することで、Permissioned DEXやレンディングプロトコルなどの機能でアクセス制御を実現できます。

**注意:** 現在、Mainnet/TestnetではPermissionedDomains Amendmentは有効になっていません。

- **PermissionedDomainSet**: 許可型ドメインを作成または更新
- **PermissionedDomainDelete**: 所有するドメインを削除

**前提条件**: アカウントが十分な準備金（Reserve）を持っている必要があります

## 📖 概要

Permissioned Domainsを用いると、Permissioned DEXやレンディングプロトコルなどの機能がドメインを使用してアクセスを制限・管理できるため、従来の金融機関がコンプライアンスルールに準拠しながらオンチェーンでサービスを提供できます。

### 主な特徴

1. **Accepted Credentials（承認された資格情報）**: ドメインは1〜10個の資格情報のリストを持ち、それらがアクセス権を付与します
2. **抽象化レイヤー**: ドメインは資格情報と制限されたリソースの間の抽象化レイヤーとして機能します
3. **自動アクセス制御**: ユーザーはドメインへの参加・離脱を申請する必要はなく、一致する資格情報を持っていれば自動的にアクセスが許可されます
4. **準備金要件**: 各ドメインは所有者の準備金要件に1アイテムとしてカウントされます

### 使用例

現在、Permissioned Domainsを使用するメインネットで利用可能なXRP Ledger機能はありません。
ただし、開発中でドメインを使用する予定のAmendmentには以下が含まれます。

- Single Asset Vault (XLS-65d) および Lending Protocol (XLS-66d)
- Permissioned DEXes

## 🚀 実行方法

### 1. Permissioned Domain作成

ドメインを作成し、承認された資格情報のリストを設定します。

```bash
npx tsx src/xrpl/PermissionedDomains/permissionedDomainSet.ts
```

このスクリプトは：
- 新しいPermissioned Domainを作成
- 承認された資格情報のリスト（AcceptedCredentials）を設定
- Domain IDを取得して表示

**注意:** 既存のDomainを更新する場合は、`DomainID`フィールドを追加して指定します。

### 2. Permissioned Domain削除

所有するドメインを削除します。

```bash
npx tsx src/xrpl/PermissionedDomains/permissionedDomainDelete.ts
```

このスクリプトは：
- 指定されたDomain IDのドメインを削除
- 準備金がアカウントに返却される

**重要:** `permissionedDomainDelete.ts`を実行する前に、`permissionedDomainSet.ts`で取得したDomain IDをコード内の`YOUR_DOMAIN_ID_HERE`に置き換えてください。

## 🔄 実行順序

完全なフローをテストする場合は、以下の順序で実行してください：

1. `permissionedDomainSet.ts` - ドメインを作成し、Domain IDを取得
2. Domain IDをメモ
3. `permissionedDomainDelete.ts` - 取得したDomain IDを使用してドメインを削除

## ✅ 予想される結果

**成功時:**
- `permissionedDomainSet.ts`実行 → 新しいPermissioned Domainが作成され、Domain IDが表示される
- `permissionedDomainDelete.ts`実行 → 指定されたDomainが削除される
- 各トランザクションでExplorerでtesSUCCESS確認可能

**失敗時（PermissionedDomainSet）:**
- `tecDIR_FULL` - 指定のアカウントがレジャーにこれ以上のオブジェクトを所有できない
- `tecINSUFFICIENT_RESERVE` - 新しいDomainを作成するための準備金が不足
- `tecNO_ENTRY` - 更新しようとしたDomainIDが存在しない
- `tecNO_ISSUER` - AcceptedCredentialsで指定された発行者が存在しない
- `tecNO_PERMISSION` - 他人が所有するDomainを変更しようとした
- `temDISABLED` - PermissionedDomainsまたはCredentials amendmentが無効

**失敗時（PermissionedDomainDelete）:**
- `tecNO_ENTRY` - 指定されたDomainIDが存在しない
- `temDISABLED` - PermissionedDomains amendmentが無効

**共通の失敗ケース:**
- `.env`不足またはノード接続失敗 → 実行不可

## 📝 AcceptedCredentialsの構造

AcceptedCredentialsは、アクセスを許可する資格情報のリストです。各アイテムは以下の形式で指定します：

```typescript
AcceptedCredentials: [
  {
    Credential: {
      Issuer: "発行者のアドレス",
      CredentialType: "資格情報タイプ（HEX形式）"
    }
  },
  // 最大10個まで
]
```

- **Issuer**: 資格情報の発行者アカウント
- **CredentialType**: 資格情報のタイプ（1〜64バイトのHEX値）

### Tips

**指定するCredentialは台帳に実際に存在していなくても設定可能です。**

- ドメイン作成時に、まだ発行されていないCredentialを事前に設定できます
- これにより、将来発行される予定のCredentialに基づいてドメインを準備できます
- ただし、実際のアクセス制御では、ユーザーが承認済み（Accepted）かつ有効期限内のCredentialを保有している必要があります

## ⚠️ Amendment要件

Permissioned Domainsを使用するには、XRPLネットワークで以下のAmendmentが有効になっている必要があります。
- `PermissionedDomains` Amendment
- `Credentials` Amendment（PermissionedDomainsはCredentialsに依存します）

## 🔍 参考文献

- [XRPL - Permissioned Domains (Concepts)](https://xrpl.org/ja/docs/concepts/tokens/decentralized-exchange/permissioned-domains)
- [XRPL - PermissionedDomainSet](https://xrpl.org/ja/docs/references/protocol/transactions/types/permissioneddomainset)
- [XRPL - PermissionedDomainDelete](https://xrpl.org/ja/docs/references/protocol/transactions/types/permissioneddomaindelete)

