import { Client, xrpToDrops, type OfferCreate, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function openOffer(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // オープンオファーの準備
    // Tips: オープンオファーは従来のDEXと同じで、誰でもアクセス可能です。
    // DomainIDを指定せず、tfHybridフラグも設定しません。
    const tx: OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: user.address,
      TakerGets: {
        currency: env.IOU_CURRENCY,
        issuer: issuer.address,
        value: '1', // 1 IOU Currency
      },
      TakerPays: xrpToDrops('1'), // 1 XRP
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = user.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('✅ オープンオファーの作成が完了しました');

    // 結果の表示
    console.log('\n📊 トランザクション結果:');
    console.log(result);

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
          '💡 ヒント: 通貨のトラストラインが存在しません。TrustSetトランザクションを先に実行してください',
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
  openOffer().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
