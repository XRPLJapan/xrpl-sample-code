import {
  Client,
  type CredentialDelete,
  convertStringToHex,
  Wallet,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function credentialDelete(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // CredentialDeleteトランザクションの準備
    // Issuerが削除する場合
    const tx: CredentialDelete = {
      TransactionType: 'CredentialDelete',
      Account: issuer.address,
      Subject: user.address,
      CredentialType: convertStringToHex('VerifiedAccount'), // 削除するCredentialType
    };

    // Subjectが削除する場合は以下のように記述
    // const tx = {
    //   TransactionType: 'CredentialDelete',
    //   Account: user.address,
    //   Issuer: issuer.address,
    //   CredentialType: convertStringToHex('VerifiedAccount'),
    // };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = issuer.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('✅ Credential削除が完了しました');

    // 結果の表示
    console.log(result);

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // よくあるエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecNO_ENTRY')) {
        console.error(
          '💡 ヒント: 削除しようとしているCredentialがレジャー上に存在しません',
        );
      } else if (error.message.includes('temINVALID_ACCOUNT_ID')) {
        console.error('💡 ヒント: 提供されたアカウントフィールドが無効です');
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
  credentialDelete().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
