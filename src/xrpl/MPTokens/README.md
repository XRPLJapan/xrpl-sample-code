# MPTokens (Multi-Purpose Tokens)

XRPLの新しいトークン標準であるMPT（Multi-Purpose Tokens）を使用するスクリプト集です。
MPTは、柔軟で効率的なトークン発行・管理を可能にする機能です。

## 🎯 MPTの特徴

- **効率的な設計**: 既存のトークン標準よりも効率的なストレージとトランザクション
- **柔軟な設定**: 最大供給量、転送手数料、メタデータなどのカスタマイズが可能
- **認可制御**: ホルダーごとの認可・非認可を管理可能
- **Clawback機能**: 必要に応じてトークンを取り戻すことが可能

## 📂 シナリオ実行コマンドと説明

### 1. MPTの発行 (MPTokenIssuanceCreate)
```bash
npx tsx src/xrpl/MPTokens/mptokenIssuanceCreate.ts
```
新しいMPTを発行します。トークンのメタデータ、最大供給量、転送手数料などを設定できます。

**主要パラメータ:**
- `AssetScale`: トークンの小数点以下の桁数（0-19）
- `MaximumAmount`: 最大供給量（オプション）
- `TransferFee`: 転送手数料（0-50000、つまり0-50%）
- `MPTokenMetadata`: トークンのメタデータ（オプション、XLS-89d標準推奨）

**MPTokenMetadata（XLS-89d標準 - 国債の例）:**
現在、XLS-89dでメタデータ構造の標準化が検討されています。この標準に準拠することで、ExplorerやIndexerでの検出性が向上します。

```json
{
  "ticker": "JGB10Y",                                  // 必須: ティッカーシンボル（10年国債）
  "name": "Japan Government Bond Token",              // 必須: トークンの表示名
  "desc": "A yield-bearing token backed by 10-year Japanese Government Bonds with fixed interest payments.", // オプション: トークンの説明
  "icon": "https://example.org/jgb-icon.png",         // 必須: アイコンURL（HTTPS）
  "asset_class": "rwa",                               // 必須: Real World Assets
  "asset_subclass": "treasury",                       // asset_class='rwa'の場合は必須
  "issuer_name": "Japan Treasury Co.",                // 必須: 発行者名
  "urls": [                                           // オプション: 関連URLリスト
    {
      "url": "https://japan-treasury.co/jgb10y",
      "type": "website",
      "title": "Product Page"
    },
    {
      "url": "https://japan-treasury.co/docs",
      "type": "docs",
      "title": "Bond Token Documentation"
    }
  ],
  "additional_info": {                                // オプション: 追加情報（金利、満期日等）
    "interest_rate": "0.50%",
    "interest_type": "fixed",
    "yield_source": "Japanese Government Bonds",
    "maturity_date": "2034-03-20",
    "bond_code": "JGB10Y-2034",
    "face_value": "1000000",
    "payment_frequency": "semi-annual"
  }
}
```

**asset_class の値:**
- `rwa`: Real World Assets（現実資産）- この場合asset_subclassが必須
- `memes`: ミームトークン
- `wrapped`: ラップされたトークン
- `gaming`: ゲーム関連トークン
- `defi`: DeFi関連トークン
- `other`: その他

**asset_subclass の値（asset_class='rwa'の場合）:**
- `treasury`: 国債
- `corporate_bond`: 社債
- `real_estate`: 不動産
- `commodity`: 商品
- `equity`: 株式
- その他のRWA関連サブクラス

### 2. 保有者の認可 (MPTokenAuthorize)

MPTの認可は、ユーザーと発行者の2つのステップで構成されます。

#### 2-1. ユーザー自身が保有を承認
```bash
npx tsx src/xrpl/MPTokens/mptokenAuthorizeByUser.ts
```
ユーザー自身がMPTの保有を承認します。これは必須のステップです。

**パラメータ:**
- `MPTokenIssuanceID`: 認可するMPTのID（環境変数から取得）

#### 2-2. 発行者がユーザーを認可
```bash
npx tsx src/xrpl/MPTokens/mptokenAuthorizeByIssuer.ts
```
発行者がユーザーを認可します。**mptokenIssuanceCreate.ts で `tfMPTRequireAuth` フラグを有効にした場合のみ必要です。**

**パラメータ:**
- `MPTokenIssuanceID`: 認可するMPTのID（環境変数から取得）
- `Holder`: 認可されるアカウント（USER_SEEDから取得）

**共通フラグ:**
- `Flags`: フラグ（オプション）
  - `tfMPTUnauthorize`: 認可を取り消す場合に使用

**認可フローの注意:**
- ユーザー承認（2-1）は常に必要
- 発行者認可（2-2）は`tfMPTRequireAuth`フラグが有効な場合のみ必要
- 両方完了してから送金が可能になります

### 3. MPTの送金 (Payment)
```bash
npx tsx src/xrpl/MPTokens/mptokenPayment.ts
```
MPTを他のアカウントに送金します。受信者は事前に認可が必要です。

**パラメータ:**
- `MPTokenIssuanceID`: MPTのID（環境変数から取得）
- `Amount`: 送金量
  ```typescript
  {
    mpt_issuance_id: "MPT_ISSUANCE_ID",
    value: "100" // 送金量
  }
  ```

**注意事項:**
- 受信者は事前に`mptokenAuthorizeByUser.ts`で保有を承認している必要があります
- `tfMPTRequireAuth`が有効な場合、受信者は`mptokenAuthorizeByIssuer.ts`での認可も必要です
- 送金後、受信者のMPT残高が表示されます

### 4. MPTの取り戻し (Clawback)
```bash
npx tsx src/xrpl/MPTokens/mptokenClawback.ts
```
発行者が保有者からMPTを取り戻します。**mptokenIssuanceCreate.ts で `tfMPTCanClawback` フラグを有効にした場合のみ実行可能です。**

**パラメータ:**
- `MPTokenIssuanceID`: MPTのID（環境変数から取得）
- `Holder`: MPTを取り戻す対象のアカウント（USER_SEEDから取得）
- `Amount`: 取り戻す数量
  ```typescript
  {
    mpt_issuance_id: "MPTID",
    value: "10" // 取り戻す量
  }
  ```

**機能:**
- Clawback前後の保有者残高を表示
- 指定したMPTokenIssuanceIDに対する残高のみを表示

### 5. MPTの破棄 (MPTokenIssuanceDestroy)
```bash
npx tsx src/xrpl/MPTokens/mptokenIssuanceDestroy.ts
```
発行されたMPTを完全に破棄します。すべての保有者が保有していないことが前提です。

**パラメータ:**
- `MPTokenIssuanceID`: 破棄するMPTのID（環境変数から取得）

**前提条件:**
- すべての保有者がトークンを保有していない状態（OutstandingAmount = 0）
- 発行者のみが実行可能

**機能:**
- 破棄前のMPTokenIssuance情報を確認
- OutstandingAmountが0でない場合は警告を表示

## ✅ 予想される結果

**成功時:**
- `mptokenIssuanceCreate.ts` → MPTのIDが発行され、レジャーに記録される
- `mptokenAuthorizeByUser.ts` → ユーザーがMPTの保有を承認
- `mptokenAuthorizeByIssuer.ts` → 発行者がユーザーを認可
- `mptokenPayment.ts` → 受信者にMPTが送金される
- `mptokenClawback.ts` → 指定した保有者からMPTが取り戻される
- `mptokenIssuanceDestroy.ts` → MPTが完全に破棄される

**失敗時:**
- 認可されていないユーザーへの送金 → `tecNO_AUTH`エラー
- Clawbackフラグなしでの取り戻し → `tecNO_PERMISSION`エラー
- 保有者が存在する状態での破棄 → `tecHAS_OBLIGATIONS`エラー
- `.env`設定不足 → 実行不可

## 🔍 主要なフラグ

### MPTokenIssuanceCreateで使用できる主なフラグ:
- `tfMPTCanLock`: トークンをロック可能にする
- `tfMPTRequireAuth`: 保有者の認可を必須にする（**有効にすると`mptokenAuthorizeByIssuer.ts`での発行者認可が必要**）
- `tfMPTCanESDT`: ESDTトークンとして使用可能にする
- `tfMPTCanTrade`: DEXでの取引機能を有効にする ※将来的にDEXでのMPTのTrade機能が実装された場合に使用可能になります
- `tfMPTCanTransfer`: 第三者間の転送機能を有効にする（TransferFeeを設定する場合は必須）
- `tfMPTCanClawback`: Clawback機能を有効にする（**有効にすると`mptokenClawback.ts`でトークンの取り戻しが可能**）
- `tfMPTCanEscrow`: Escrow機能を有効にする ※TokenEscrow Amendmentが有効なネットワークでのみ動作します

### MPTokenAuthorizeで使用できる主なフラグ:
- `tfMPTUnauthorize`: 認可を取り消す場合に使用

## 🔗 参考文献

- [XRPL - MPTokenIssuanceCreate](https://xrpl.org/ja/docs/references/protocol/transactions/types/mptokenissuancecreate/)
- [XRPL - MPTokenAuthorize](https://xrpl.org/ja/docs/references/protocol/transactions/types/mptokenauthorize/)
- [XRPL - Clawback](https://xrpl.org/ja/docs/references/protocol/transactions/types/clawback/)
- [XLS-89d Standard](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0089-multi-purpose-token-metadata-schema)

## 📝 注意事項

1. **Amendment要件**: MPTokensV1 Amendmentが有効なネットワークでのみ動作します
2. **環境変数**: すべてのスクリプトは`.env`ファイルから設定を読み込みます
   - `ISUEER_SEED`: 発行者のシークレット
   - `USER_SEED`: ユーザーのシークレット
   - `MPT_ISSUANCE_ID`: MPTokenIssuanceID（`mptokenIssuanceCreate.ts`実行後に設定）
3. **認可フロー**: 
   - ユーザー承認（`mptokenAuthorizeByUser.ts`）は常に必要
   - `tfMPTRequireAuth`フラグを設定した場合、発行者認可（`mptokenAuthorizeByIssuer.ts`）も必要
4. **Clawback**: `tfMPTCanClawback`フラグを設定すると、発行者がMPTを取り戻せます
5. **破棄条件**: MPTを破棄するには、すべての保有者が保有していない状態（OutstandingAmount = 0）が必要です
6. **不可逆的な操作**: 一度設定したフラグは変更できないため、慎重に設定してください
7. **メタデータ標準**: XLS-89d標準に準拠することで、ExplorerやIndexerでの検出性が向上します
8. **残高表示**: 送金・Clawback実行時は、指定したMPTokenIssuanceIDに対する残高のみを表示します

