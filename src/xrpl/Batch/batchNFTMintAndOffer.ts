import { type Batch, Client, hashes, type NFTokenBurn, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { getBatchTxStatus } from '../../lib/getBatchTxStatus';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

/**
 * Batch トランザクション: 複数NFTの一括焼却
 *
 * このサンプルでは、8つのNFTを1つのバッチトランザクションで一括焼却します。
 * Independent モードを使用することで、各NFTの焼却が独立して実行され、
 * 一部が失敗しても他のNFTの焼却は継続されます。
 *
 * 📝 内部トランザクションの結果確認方法:
 * 1. Batchトランザクションを送信
 * 2. レジャーからBatchトランザクションの tx_json.RawTransactions を取得
 * 3. 各RawTransactionからハッシュを計算
 * 4. 計算したハッシュで各内部トランザクションの結果を個別に確認
 *
 * ⚠️ 事前準備:
 * このサンプルを実行する前に、焼却するNFTを事前にミントしておく必要があります。
 * 以下のコマンドで NFTokenID を取得してください：
 * ```
 * npx tsx src/xrpl/NFToken/nftokenMint.ts
 * ```
 * 取得した NFTokenID を下記のコードの NFTOKEN_IDS 配列に設定してください。
 *
 * ユースケース例:
 * - 期限切れNFTの一括削除
 * - 大量のNFTコレクションのクリーンアップ
 * - イベント終了後のチケットNFT一括無効化
 */
export async function batchNFTBurn(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔄 Batch トランザクション (8つのNFT一括焼却) を準備します...');
    console.log(`所有者アドレス: ${issuer.address}`);

    // ⚠️ 重要: 以下のNFTokenIDは実際にミント済みのNFTのIDに置き換えてください
    // npx tsx src/xrpl/NFToken/nftokenMint.ts を8回実行して取得した NFTokenID を設定します
    const NFTOKEN_IDS = [
      '00000000000000000000000000000000000000000000000000000000000000000000000000000001', // 例: 実際のNFTokenIDに置き換え
      '00000000000000000000000000000000000000000000000000000000000000000000000000000002',
      '00000000000000000000000000000000000000000000000000000000000000000000000000000003',
      '00000000000000000000000000000000000000000000000000000000000000000000000000000004',
      '00000000000000000000000000000000000000000000000000000000000000000000000000000005',
      '00000000000000000000000000000000000000000000000000000000000000000000000000000006',
      '00000000000000000000000000000000000000000000000000000000000000000000000000000007',
      '00000000000000000000000000000000000000000000000000000000000000000000000000000008',
    ];

    // 内部トランザクションを配列で管理
    const innerTransactions: NFTokenBurn[] = NFTOKEN_IDS.map((nftokenID) => ({
      TransactionType: 'NFTokenBurn',
      Account: issuer.address,
      NFTokenID: nftokenID,
      Flags: 0x40000000, // tfInnerBatchTxn（必須）
      SigningPubKey: '',
      Fee: '0',
    }));

    console.log('\n📦 バッチ内容:');
    innerTransactions.forEach((tx, index) => {
      console.log(
        `  トランザクション${index + 1}: NFT焼却 (${tx.NFTokenID.substring(0, 16)}...)`,
      );
    });
    console.log(`  合計トランザクション数: ${innerTransactions.length}`);
    console.log('  モード: Independent (各トランザクションが独立して実行)');

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
      console.log(
        `  ${statusIcon} トランザクション${tx.index} (NFTokenBurn): ${tx.status}`,
      );
    });

    // 成功・失敗の統計
    const successCount = innerTxStatuses.filter((tx) => tx.successful).length;
    const failedCount = innerTxStatuses.filter((tx) => !tx.successful).length;

    console.log('\n📊 実行統計:');
    console.log(`  成功: ${successCount}件`);
    console.log(`  失敗: ${failedCount}件`);

    if (failedCount > 0) {
      console.log('\n  ⚠️  一部のNFT焼却が失敗しました');
      console.log(
        '  💡 Independent モードのため、失敗したトランザクションがあっても成功したものは実行されました',
      );
      console.log('  💡 失敗の原因:');
      console.log('     - NFTokenIDが存在しない');
      console.log('     - NFTの所有者が異なる');
      console.log('     - NFTが既に焼却済み');
    } else {
      console.log('\n  ✅ すべてのNFTが正常に焼却されました');
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
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: NFTを焼却する権限がありません（所有者ではない可能性があります）',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたNFTokenIDが存在しません');
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
  batchNFTBurn().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
