import { Client, type TrustSet, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function trustSet(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const user = Wallet.fromSeed(env.USER_SEED);
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // TrustSetトランザクションの準備
    const tx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: user.address,
      LimitAmount: {
        currency: env.IOU_CURRENCY, // 通貨コード（3文字）
        issuer: issuer.address, // 発行者アドレス
        value: '1000000', // 信頼限度額（文字列）
      },
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = user.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('✅ TrustLine設定が完了しました');

    // 結果の表示
    console.log(result);

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // よくあるエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecUNFUNDED_PAYMENT')) {
        console.error('💡 ヒント: アカウントの準備金が不足しています');
      } else if (error.message.includes('temBAD_CURRENCY')) {
        console.error(
          '💡 ヒント: 通貨コードが無効です（3文字である必要があります）',
        );
      } else if (error.message.includes('temINVALID_FLAG')) {
        console.error('💡 ヒント: フラグの設定が無効です');
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
  trustSet().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
