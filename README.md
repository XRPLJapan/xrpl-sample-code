# XRPL サンプルコード集

XRPLの主要機能（ウォレット作成/管理、送金、TrustSet、Credential、NFT等）をテストできるシナリオベースのサンプルコード集です。

## 📑 目次
- [🚀 クイックスタート](#-クイックスタート)
- [🗂️ 全体ディレクトリ構造](#-全体ディレクトリ構造)
- [📂 フォルダ別README](#-フォルダ別readme)
- [🔗 XRPL Devnet Explorer](#-xrpl-devnet-explorer)
- [🌐 ネットワーク / バージョン](#-ネットワーク--バージョン)

## 🚀 クイックスタート

```bash
# 0) リポジトリクローン
git clone https://github.com/XRPLJapan/xrpl-sample-code.git
cd XRPL

# 1) 依存関係インストール
npm install

# 2) 環境変数設定
cp .env.example .env
# .envファイルを編集して必要な値を設定

# 3) XRP送金テスト
npx tsx src/xrpl/Payment/sendXRP.ts

# 4) TrustLine設定
npx tsx src/xrpl/TrustSet/trustSet.ts

# 5) IOU送金テスト
npx tsx src/xrpl/Payment/sendIOU.ts

# 6) Credential作成
npx tsx src/xrpl/Credentials/credentialCreate.ts

# 7) MPToken発行
npx tsx src/xrpl/MPTokens/mptokenIssuanceCreate.ts

# 8) NFT発行
npx tsx src/xrpl/NFToken/nftokenMint.ts

# 9) Batchトランザクション（複数トランザクションを一括実行）
npx tsx src/xrpl/Batch/batchAllOrNothing.ts
```

クイックスタート後、機能別実行コマンドと簡単なシナリオ理解はGitHubフォルダ別READMEで、
フォルダ別全体コードと詳細実行ログを含むスクリプト解釈はNotion文書で確認してください。

## 🗂️ 全体ディレクトリ構造

```
src/
├── config/           # 設定ファイル
│   ├── env.ts        # 環境変数バリデーション
│   └── network.ts    # ネットワーク設定
│
├── lib/              # ユーティリティ
│   ├── logger.ts     # ログ出力機能
│   └── xrplClient.ts # XRPLクライアント作成
│
└── xrpl/             # XRPL機能実装
    ├── Batch/        # バッチトランザクション
    │   ├── batchAllOrNothing.ts
    │   ├── batchOnlyOne.ts
    │   ├── batchUntilFailure.ts
    │   ├── batchIndependent.ts
    │   ├── batchNFTMintAndBurn.ts
    │   └── README.md
    │
    ├── Credentials/  # 検証可能な資格情報
    │   ├── credentialCreate.ts
    │   ├── credentialAccept.ts
    │   ├── credentialDelete.ts
    │   └── README.md
    │
    ├── MPTokens/     # Multi-Purpose Tokens
    │   ├── mptokenIssuanceCreate.ts
    │   ├── mptokenAuthorize.ts
    │   ├── mptokenPayment.ts
    │   ├── mptokenClawback.ts
    │   ├── mptokenIssuanceDestroy.ts
    │   └── README.md
    │
    ├── NFToken/      # NFT管理
    │   ├── nftokenMint.ts
    │   ├── nftokenMintOffer.ts
    │   ├── nftokenBurn.ts
    │   ├── nftokenCreateOffer.ts
    │   ├── nftokenAcceptOffer.ts
    │   ├── nftokenCancelOffer.ts
    │   ├── nftokenDynamic.ts
    │   └── README.md
    │
    ├── Payment/      # XRP/IOU送金
    │   ├── sendIOU.ts
    │   ├── sendXRP.ts
    │   └── README.md
    │
    └── TrustSet/     # 信頼線設定
        ├── trustSet.ts
        └── README.md
```

## 📂 フォルダ別README

- [Batch](src/xrpl/Batch/README.md) - バッチトランザクション（複数トランザクションの一括実行）
- [Credentials](src/xrpl/Credentials/README.md) - 検証可能な資格情報管理機能
- [MPTokens](src/xrpl/MPTokens/README.md) - Multi-Purpose Tokens（MPトークン）発行・管理機能
- [NFToken](src/xrpl/NFToken/README.md) - NFT発行・管理機能
- [Payment](src/xrpl/Payment/README.md) - XRP/IOU送金機能
- [TrustSet](src/xrpl/TrustSet/README.md) - 信頼線設定機能

## 🔍 Batchトランザクション結果の確認

Batchトランザクションは外側のトランザクション自体は常に `tesSUCCESS` を返します。内部トランザクションが失敗した場合でも、Batchトランザクション自体は成功として記録されます。

### 内部トランザクションの成功/失敗を確認する方法

各内部トランザクションの `meta.TransactionResult` を個別に確認します：

```typescript
import { hashes } from 'xrpl';
import { getBatchTxStatus } from './lib/getBatchTxStatus';

// 1. Batch トランザクションを送信
const result = await client.submitAndWait(signed.tx_blob);

// 2. レジャーからBatchトランザクションの詳細を取得
const batchTxData = await client.request({
  command: 'tx',
  transaction: result.result.hash,
});

// 3. tx_json.RawTransactions から内部トランザクションを取得してハッシュを計算
const rawTransactions = batchTxData.result.tx_json.RawTransactions;
const innerTxHashes = rawTransactions.map((rawTx, index) => {
  const txHash = hashes.hashSignedTx(rawTx.RawTransaction);
  return { hash: txHash, index: index + 1 };
});

// 4. 各内部トランザクションの結果を個別に取得
const innerTxStatuses = await getBatchTxStatus(client, innerTxHashes);

// 5. 失敗時の処理
const failedTxs = innerTxStatuses.filter(tx => !tx.successful);
if (failedTxs.length > 0) {
  // リトライロジックや通知処理
}
```

**ポイント:**
- Batchトランザクション送信後、レジャーから `tx_json.RawTransactions` を取得
- レジャーから取得した RawTransaction（Sequence等が含まれる）からハッシュを計算
- 計算したハッシュで各内部トランザクションを個別に確認
- `tesSUCCESS` 以外はすべて失敗として扱う

詳細は [Batch README](src/xrpl/Batch/README.md) を参照してください。

## 🔗 XRPL Devnet Explorer

👉 [https://devnet.xrpl.org/](https://devnet.xrpl.org/)

## 🌐 ネットワーク / バージョン

| 項目 | 値 |
|------|-----|
| ネットワーク | XRPL Devnet (wss://s.devnet.rippletest.net:51233) |
| rippled | v2.5.0 |
| xrpl.js | package.json参照 |
| Node.js | LTS推奨 |
