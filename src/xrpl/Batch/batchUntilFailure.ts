import {
  type Batch,
  Client,
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
 * Batch トランザクション: Until Failure モード
 *
 * このサンプルでは、複数のXRP支払いトランザクションをバッチとして実行します。
 * tfUntilFailure フラグにより、トランザクションが順番に実行され、
 * 最初の失敗が発生したら残りのトランザクションはスキップされます。
 *
 * このサンプルでは2番目のトランザクションが意図的に失敗するように設定されています：
 * - トランザクション1: 0.5 XRP → 成功
 * - トランザクション2: 999999 XRP → 残高不足で失敗
 * - トランザクション3: 0.5 XRP → スキップされる（実行されない）
 *
 * 📝 内部トランザクションの結果確認方法:
 * 1. Batchトランザクションを送信
 * 2. レジャーからBatchトランザクションの tx_json.RawTransactions を取得
 * 3. 各RawTransactionからハッシュを計算
 * 4. 計算したハッシュで各内部トランザクションの結果を個別に確認
 *
 * ユースケース例:
 * - 複数の順次処理を実行し、エラーが発生したら停止
 * - 段階的な資産移動（最初の移動が成功したら次へ進む）
 * - 優先順位付き処理の実行
 */
export async function batchUntilFailure(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔄 Batch トランザクション (Until Failure) を準備します...');
    console.log(`送信者アドレス: ${issuer.address}`);
    console.log(`受信者アドレス: ${user.address}`);

    // 内部トランザクションを配列で管理
    const innerTransactions: Payment[] = [
      {
        TransactionType: 'Payment',
        Account: issuer.address,
        Destination: user.address,
        Amount: xrpToDrops('0.5'), // 0.5 XRP
        Flags: 0x40000000, // tfInnerBatchTxn フラグ（必須）
        SigningPubKey: '',
        Fee: '0',
      },
      {
        TransactionType: 'Payment',
        Account: issuer.address,
        Destination: user.address,
        Amount: xrpToDrops('999999'), // 999999 XRP - 残高不足で失敗
        Flags: 0x40000000,
        SigningPubKey: '',
        Fee: '0',
      },
      {
        TransactionType: 'Payment',
        Account: issuer.address,
        Destination: user.address,
        Amount: xrpToDrops('0.5'), // 0.5 XRP - Until Failureモードのためスキップされる
        Flags: 0x40000000,
        SigningPubKey: '',
        Fee: '0',
      },
    ];

    console.log('\n📦 バッチ内容:');
    innerTransactions.forEach((tx, index) => {
      const amountInXRP = (Number(tx.Amount) / 1000000).toFixed(1);
      const note =
        index === 1
          ? ' ← 残高不足で失敗'
          : index === 2
            ? ' ← スキップされる'
            : '';
      console.log(
        `  トランザクション${index + 1}: ${amountInXRP} XRP を送信${note}`,
      );
    });
    console.log(`  合計トランザクション数: ${innerTransactions.length}`);
    console.log('  モード: Until Failure (失敗するまで順次実行)');

    // Batch トランザクションの準備
    const batchTx: Batch = {
      TransactionType: 'Batch',
      Account: issuer.address,
      Flags: 0x00040000, // tfUntilFailure (262144)
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
    console.log(`  失敗/スキップ: ${failedCount}件`);
    console.log(
      '  💡 Until Failure モードのため、2番目の失敗で残りがスキップされました',
    );

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
  batchUntilFailure().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
