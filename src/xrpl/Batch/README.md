# Batch トランザクション

XRPLのBatchトランザクション機能を使って、複数のトランザクションを1つのバッチとしてアトミックに実行するサンプルコード集です。

## 📖 概要

Batch トランザクションは、最大8つのトランザクションを1つのバッチとしてまとめて実行できる機能です。複雑な操作を信頼性高く、予測可能に実行できます。

### Batch の4つのモード

1. **All or Nothing (tfAllOrNothing)**: すべてのトランザクションが成功するか、すべて失敗する
2. **Only One (tfOnlyOne)**: 最初に成功したトランザクションのみが適用される
3. **Until Failure (tfUntilFailure)**: 最初の失敗まですべてのトランザクションを適用
4. **Independent (tfIndependent)**: すべてのトランザクションを失敗に関係なく適用

## 🚀 実行方法

### 1. All or Nothing - すべて成功またはすべて失敗

複数のXRP支払いを同時に行い、どれか一つでも失敗したらすべてロールバックされます。

```bash
npx tsx src/xrpl/Batch/batchAllOrNothing.ts
```

### 2. Only One - 最初の成功のみ

異なる金額の支払いを試行し、最初に成功したもののみを実行します。

```bash
npx tsx src/xrpl/Batch/batchOnlyOne.ts
```

### 3. Until Failure - 失敗まで順次実行

複数のトランザクションを順番に実行し、失敗したら残りをスキップします。

```bash
npx tsx src/xrpl/Batch/batchUntilFailure.ts
```

### 4. Independent - 独立して実行

複数のトランザクションをそれぞれ独立して実行します。

```bash
npx tsx src/xrpl/Batch/batchIndependent.ts
```

### 5. NFTミント & 焼却 - NFTライフサイクル

8つのNFTをミントし、その後すぐに焼却する2段階のBatchトランザクションを実行します。

```bash
npx tsx src/xrpl/Batch/batchNFTMintAndBurn.ts
```

**処理フロー:**
1. 8つのNFTを一括ミント（Batch 1 - Independent モード）
2. ミントされたNFTokenIDを取得
3. 取得したNFTを一括焼却（Batch 2 - Independent モード）

## 📝 重要な注意点

### ⚠️ トランザクション結果の確認方法

**Batchトランザクション自体は常に `tesSUCCESS` を返します**

- Batchトランザクションがネットワークに受け入れられると、外側のトランザクション結果は `tesSUCCESS` になります
- **内部トランザクションの実際の成功/失敗は `meta.TransactionResult` で確認する必要があります**
- All or Nothing モードで内部トランザクションが失敗した場合も、Batchトランザクション自体は `tesSUCCESS` として記録されます

```typescript
// ❌ これだけでは不十分
validateTransactionResult(result); // 常に tesSUCCESS

// ✅ 各内部トランザクションの meta.TransactionResult を個別に確認
import { hashes } from 'xrpl';
import { getBatchTxStatus } from '../../lib/getBatchTxStatus';

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

// 5. 結果を確認
innerTxStatuses.forEach((tx) => {
  console.log(`トランザクション${tx.index}: ${tx.status}`);
});

// 6. 失敗時の処理
const failedTxs = innerTxStatuses.filter(tx => !tx.successful);
if (failedTxs.length > 0) {
  console.log('内部トランザクションが失敗しました（All or Nothingによりロールバック）');
  // リトライロジックや通知処理
} else {
  console.log('すべての内部トランザクションが成功しました');
}
```

**検知のポイント:**
- Batchトランザクション送信後、レジャーから `tx_json.RawTransactions` を取得
- レジャーから取得した RawTransaction（Sequence等が含まれる）からハッシュを計算
- 計算したハッシュで各内部トランザクションを個別に確認
- `getBatchTxStatus` で各内部トランザクションの `meta.TransactionResult` を個別に確認
- `tesSUCCESS` 以外はすべて失敗として扱う

### 内部トランザクションの要件

Batch内の内部トランザクション（InnerTransaction）には以下の要件があります：

1. **tfInnerBatchTxn フラグを設定**: `Flags: 0x40000000` (1073741824)
2. **手数料は0**: 内部トランザクションの`Fee`は`"0"`に設定（外部トランザクションで支払われます）
3. **署名なし**: `SigningPubKey`は空文字列`""`にする必要があります

### 手数料の計算

Batchトランザクションの手数料は以下のように計算されます：

```
2 × (Base Fee) + SUM(Inner Transaction Fees) + 追加署名ごとのBase Fee
```

### セキュリティ考慮事項

- **単一アカウント**: アカウント自身が送信するすべてのトランザクションを承認する必要があります
- **複数アカウント**: すべての参加アカウントがバッチ全体に署名する必要があります（`BatchSigners`フィールドを使用）

## 🔗 参考リンク

- [XRPL Batch Transactions - Concepts](https://xrpl.org/ja/docs/concepts/transactions/batch-transactions)
- [XRPL Batch Transaction Type](https://xrpl.org/ja/docs/references/protocol/transactions/types/batch)

## ⚠️ Amendment要件

Batch トランザクションを使用するには、XRPLネットワークで`Batch` Amendmentが有効になっている必要があります。
2025/10/20 現在、`Batch` AmendmentはMainnet/Testnetでは有効になっていません。

