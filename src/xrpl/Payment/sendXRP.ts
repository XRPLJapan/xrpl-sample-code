import { Client, type Payment, Wallet, xrpToDrops } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function sendXRP(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // 送金トランザクションの準備
    const tx: Payment = {
      TransactionType: 'Payment',
      Account: issuer.address,
      Destination: user.address,
      Amount: xrpToDrops(0.5).toString(), // 0.5 XRP = 500,000 drops
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = issuer.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('✅ 送金処理が完了しました');

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
        console.error('💡 ヒント: 送信者のXRP残高が不足しています');
      } else if (error.message.includes('tecNO_DST')) {
        console.error('💡 ヒント: 宛先アカウントが存在しません');
      } else if (error.message.includes('tecNO_DST_INSUF_XRP')) {
        console.error('💡 ヒント: 宛先アカウントの準備金が不足しています');
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
  sendXRP().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
