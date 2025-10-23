import { Client, xrpToDrops, type OfferCreate, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function outsiderOffer(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // OUTSIDER_SEEDの確認
    if (!env.OUTSIDER_SEED) {
      console.error(
        '❌ OUTSIDER_SEEDが設定されていません。.envファイルにOUTSIDER_SEEDを設定してください。',
      );
      console.error(
        '💡 ヒント: Permissioned DEXのアクセス制御を確認するには、ドメインメンバーではないアカウントが必要です。',
      );
      return false;
    }

    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const outsider = Wallet.fromSeed(env.OUTSIDER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('👤 ドメインメンバーではないアカウントのオファーを作成します');
    console.log(`外部者アドレス: ${outsider.address}`);
    console.log(
      '\n💡 このアカウントはPermissioned Domainのメンバーではありません',
    );

    // 外部者のオープンオファーの準備
    // Tips: ドメインメンバーではないアカウントは、オープンオファーのみ作成可能です。
    // パーミッションオファーを作成しようとするとtecNO_PERMISSIONエラーが発生します。
    const tx: OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: outsider.address,
      TakerGets: xrpToDrops('1'), // 1 XRP
      TakerPays: {
        currency: env.IOU_CURRENCY,
        issuer: issuer.address,
        value: '1', // 1 IOU Currency
      },
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = outsider.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log(
      '\n✅ ドメインメンバーではないアカウントのオープンオファー作成が完了しました',
    );

    // 結果の表示
    console.log('\n📊 トランザクション結果:');
    console.log(result);

    console.log('\n💡 このオファーはオープンDEXにのみ配置されます');
    console.log(
      '💡 オープンオファーやハイブリッドオファーとはマッチング可能です',
    );
    console.log(
      '💡 パーミッションオファーとはマッチングしません（アクセス制御により拒否）',
    );

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // よくあるエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecUNFUNDED_OFFER')) {
        console.error(
          '💡 ヒント: オファーを実行するための残高が不足しています',
        );
      } else if (error.message.includes('tecNO_LINE')) {
        console.error(
          '💡 ヒント: 通貨のトラストラインが存在しません。trustSetOutsider.tsを実行してください',
        );
      } else if (error.message.includes('tecINSUFF_RESERVE_OFFER')) {
        console.error(
          '💡 ヒント: オファーを作成するための準備金が不足しています',
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
  outsiderOffer().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
