import {
  type Batch,
  Client,
  dropsToXrp,
  hashes,
  type Payment,
  Wallet,
  xrpToDrops,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { getBatchTxStatus } from '../../lib/getBatchTxStatus';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

/**
 * Batch トランザクション: Independent モード
 *
 * このサンプルでは、複数のXRP支払いトランザクションをバッチとして実行します。
 * tfIndependent フラグにより、各トランザクションが独立して実行され、
 * 一部のトランザクションが失敗しても他のトランザクションは実行されます。
 *
 * 📝 内部トランザクションの結果確認方法:
 * 1. Batchトランザクションを送信
 * 2. レジャーからBatchトランザクションの tx_json.RawTransactions を取得
 * 3. 各RawTransactionからハッシュを計算
 * 4. 計算したハッシュで各内部トランザクションの結果を個別に確認
 *
 * ユースケース例:
 * - 複数の独立した処理を一度に実行
 * - エラーハンドリングを個別に行いたい複数の操作
 * - ベストエフォートで複数の操作を試行
 */
export async function batchIndependent(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔄 Batch トランザクション (Independent) を準備します...');
    console.log(`送信者アドレス: ${issuer.address}`);
    console.log(`受信者アドレス: ${user.address}`);

    // 内部トランザクションを配列で管理
    const innerTransactions: Payment[] = [
      {
        TransactionType: 'Payment',
        Account: issuer.address,
        Destination: user.address,
        Amount: xrpToDrops('0.3'), // 0.3 XRP
        Flags: 0x40000000, // tfInnerBatchTxn フラグ（必須）
        SigningPubKey: '',
        Fee: '0',
      },
      {
        TransactionType: 'Payment',
        Account: issuer.address,
        Destination: user.address,
        Amount: xrpToDrops('0.4'), // 0.4 XRP
        Flags: 0x40000000,
        SigningPubKey: '',
        Fee: '0',
      },
      {
        TransactionType: 'Payment',
        Account: issuer.address,
        Destination: user.address,
        Amount: xrpToDrops('0.5'), // 0.5 XRP
        Flags: 0x40000000,
        SigningPubKey: '',
        Fee: '0',
      },
    ];

    console.log('\n📦 バッチ内容:');
    innerTransactions.forEach((tx, index) => {
      const amountInXRP = dropsToXrp(tx.Amount.toString());
      console.log(`  トランザクション${index + 1}: ${amountInXRP} XRP を送信`);
    });
    console.log(`  合計トランザクション数: ${innerTransactions.length}`);
    console.log('  モード: Independent (すべて独立して実行)');

    // Batch トランザクションの準備
    const batchTx: Batch = {
      TransactionType: 'Batch',
      Account: issuer.address,
      Flags: 0x00080000, // tfIndependent (524288)
      RawTransactions: innerTransactions.map((tx) => ({ RawTransaction: tx })),
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）

    const prepared = await client.autofill(batchTx);

    // トランザクションに署名
    const signed = issuer.sign(prepared);

    // トランザクションを送信して結果を待機
    console.log('\n⏳ トランザクションを送信中...');
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ Batch トランザクション自体は完了しました（tesSUCCESS）');

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    // レジャーから内部トランザクションのハッシュを取得して結果を確認
    console.log('\n📊 内部トランザクションの実行結果を確認中...');

    // レジャーからBatchトランザクションの詳細を取得
    const batchTxData = await client.request({
      command: 'tx',
      transaction: result.result.hash,
    });

    // tx_json.RawTransactions から内部トランザクションを取得
    const txJson = batchTxData.result.tx_json;
    const rawTransactions = txJson?.RawTransactions;

    if (!rawTransactions || !Array.isArray(rawTransactions)) {
      console.log('⚠️  内部トランザクションが見つかりませんでした');
      return false;
    }

    // 各内部トランザクションのハッシュを計算
    const innerTxHashes: Array<{ hash: string; index: number }> = [];

    for (let i = 0; i < rawTransactions.length; i++) {
      const innerTx = rawTransactions[i].RawTransaction;
      if (innerTx) {
        try {
          const txHash = hashes.hashSignedTx(innerTx);
          innerTxHashes.push({ hash: txHash, index: i + 1 });
        } catch (error) {
          console.error(
            `  ⚠️  トランザクション${i + 1}のハッシュ計算に失敗:`,
            error,
          );
        }
      }
    }

    if (innerTxHashes.length === 0) {
      console.log('⚠️  内部トランザクションのハッシュが計算できませんでした');
      return false;
    }

    // 各内部トランザクションの結果を個別に取得
    const innerTxStatuses = await getBatchTxStatus(client, innerTxHashes);

    // 結果の表示
    console.log('\n📝 内部トランザクションの実行結果:');
    innerTxStatuses.forEach((tx) => {
      const statusIcon = tx.successful ? '✅' : '❌';
      console.log(`  ${statusIcon} トランザクション${tx.index}: ${tx.status}`);
    });

    // 成功・失敗の統計
    const successCount = innerTxStatuses.filter((tx) => tx.successful).length;
    const failedCount = innerTxStatuses.filter((tx) => !tx.successful).length;

    console.log('\n📊 実行統計:');
    console.log(`  成功: ${successCount}件`);
    console.log(`  失敗: ${failedCount}件`);
    console.log(
      '  💡 Independent モードのため、各トランザクションは独立して実行されました',
    );

    // 失敗したトランザクションがあれば詳細を表示
    if (failedCount > 0) {
      const failedTxs = innerTxStatuses.filter((tx) => !tx.successful);
      console.log('\n  ⚠️  失敗したトランザクション:');
      failedTxs.forEach((failedTx) => {
        const originalTx = innerTransactions[failedTx.index - 1];
        if (originalTx) {
          const amount = Number(originalTx.Amount);
          console.log(
            `    - トランザクション${failedTx.index}: ${failedTx.status}`,
          );
          console.log(
            `      金額: ${amount} drops (${(amount / 1000000).toFixed(1)} XRP)`,
          );
          console.log(`      宛先: ${originalTx.Destination}`);
        }
      });
    }

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // Batch特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temINVALID_INNER_BATCH')) {
        console.error('💡 ヒント: 内部トランザクションが不正です');
      } else if (error.message.includes('temSEQ_AND_TICKET')) {
        console.error(
          '💡 ヒント: TicketSequenceとSequenceの両方が指定されています',
        );
      } else if (error.message.includes('tecUNFUNDED_PAYMENT')) {
        console.error('💡 ヒント: 送信者のXRP残高が不足しています');
      } else if (error.message.includes('temDISABLED')) {
        console.error(
          '💡 ヒント: Batch Amendmentが有効ではありません。Devnet/Testnetを使用していることを確認してください',
        );
      }
    }

    return false;
  } finally {
    // 接続を終了
    await client.disconnect();
  }
}

// スクリプトが直接実行された場合の処理
if (import.meta.url === `file://${process.argv[1]}`) {
  batchIndependent().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
