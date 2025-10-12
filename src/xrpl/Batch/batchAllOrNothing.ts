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
 * Batch トランザクション: All or Nothing モード
 *
 * このサンプルでは、2つのXRP支払いトランザクションをバッチとして実行します。
 * tfAllOrNothing フラグにより、すべてのトランザクションが成功するか、
 * すべて失敗するかのどちらかになります。
 *
 * ⚠️ 重要な注意点:
 * - Batchトランザクション自体は常に tesSUCCESS を返します
 * - 内部トランザクションの成功/失敗は、各内部トランザクションを個別に確認する必要があります
 * - All or Nothingモードでは、1つでも失敗すると全てロールバックされますが、
 *   Batchトランザクション自体は tesSUCCESS として記録されます
 *
 * 📝 内部トランザクションの結果確認方法:
 * 1. Batchトランザクションを送信
 * 2. レジャーからBatchトランザクションの tx_json.RawTransactions を取得
 * 3. 各RawTransactionからハッシュを計算
 * 4. 計算したハッシュで各内部トランザクションの結果を個別に確認
 *
 * ユースケース例:
 * - NFTミントとオファー作成を同時に行う
 * - 複数の支払いを一度に行い、一つでも失敗したら全てキャンセルする
 * - プラットフォーム手数料を含むトランザクション
 */
export async function batchAllOrNothing(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔄 Batch トランザクション (All or Nothing) を準備します...');
    console.log(`送信者アドレス: ${issuer.address}`);
    console.log(`受信者アドレス: ${user.address}`);

    // 内部トランザクションを配列で管理
    const innerTransactions: Payment[] = [
      // トランザクション1: 最初の支払い
      {
        TransactionType: 'Payment',
        Account: issuer.address,
        Destination: user.address,
        Amount: xrpToDrops('1'), // 1 XRP
        Flags: 0x40000000, // tfInnerBatchTxn フラグ（必須）
        SigningPubKey: '', // 空文字列（内部トランザクションは署名なし）
        Fee: '0', // 0に設定（外部トランザクションで支払われる）
      },
      // トランザクション2: 2番目の支払い
      {
        TransactionType: 'Payment',
        Account: issuer.address,
        Destination: user.address,
        Amount: xrpToDrops('0.5'), // 0.5 XRP
        Flags: 0x40000000, // tfInnerBatchTxn フラグ（必須）
        SigningPubKey: '', // 空文字列
        Fee: '0', // 0に設定
      },
      // トランザクション3: 失敗するトランザクション
      // このトランザクションを有効にすると、残高不足でバッチ全体が失敗します
      // All or Nothing モードでは、1つでも失敗するとすべてがロールバックされます
      // {
      //   TransactionType: 'Payment',
      //   Account: issuer.address,
      //   Destination: user.address,
      //   Amount: xrpToDrops('999999'), // 非現実的な大きな金額 → 残高不足で失敗
      //   Flags: 0x40000000, // tfInnerBatchTxn フラグ（必須）
      //   SigningPubKey: '', // 空文字列
      //   Fee: '0', // 0に設定
      // },
    ];

    console.log('\n📦 バッチ内容:');
    innerTransactions.forEach((tx, index) => {
      console.log(`  トランザクション${index + 1}: ${tx.Amount} drops を送信`);
    });
    console.log(`  合計トランザクション数: ${innerTransactions.length}`);
    console.log('  モード: All or Nothing (すべて成功 or すべて失敗)');

    // Batch トランザクションの準備
    const batchTx: Batch = {
      TransactionType: 'Batch',
      Account: issuer.address,
      Flags: 0x00010000, // tfAllOrNothing (65536)
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

    // 失敗したトランザクションの詳細を表示
    const failedTxs = innerTxStatuses.filter((tx) => !tx.successful);
    if (failedTxs.length > 0) {
      console.log(
        '\n  ❌ 判定: 一部またはすべての内部トランザクションが失敗しました',
      );
      console.log(
        '  💡 All or Nothing モードのため、すべてのトランザクションがロールバックされました',
      );
      console.log('  💰 手数料のみが支払われ、送金は実行されませんでした');

      console.log('\n  🔍 失敗したトランザクション:');
      failedTxs.forEach((failedTx) => {
        const originalTx = innerTransactions[failedTx.index - 1];
        if (originalTx) {
          const amount = Number(originalTx.Amount);
          console.log(
            `    - トランザクション${failedTx.index}: ${failedTx.status}`,
          );
          console.log(`      ハッシュ: ${failedTx.hash}`);
          console.log(
            `      金額: ${amount} drops (${(amount / 1000000).toFixed(6)} XRP)`,
          );
          console.log(`      宛先: ${originalTx.Destination}`);
        }
      });

      return false;
    }

    console.log(
      '\n  ✅ 判定: すべての内部トランザクションが正常に実行されました',
    );
    console.log('  💡 All or Nothing モードのため、すべてが成功しました');
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
  batchAllOrNothing().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
