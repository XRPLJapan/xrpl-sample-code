import {
  Client,
  Wallet,
  convertStringToHex,
  type CredentialAccept,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';

export async function credentialAccept(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // CredentialAcceptトランザクションの準備
    const tx: CredentialAccept = {
      TransactionType: 'CredentialAccept',
      Account: user.address,
      Issuer: issuer.address,
      CredentialType: convertStringToHex('VerifiedAccount'), // 作成時と同じCredentialType
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = user.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認
    const txResult =
      typeof result.result.meta === 'object' &&
      'TransactionResult' in result.result.meta
        ? result.result.meta.TransactionResult
        : 'unknown';

    if (txResult !== 'tesSUCCESS') {
      throw new Error(`Transaction failed: ${txResult}`);
    }

    console.log('✅ Credential受け入れが完了しました');

    // 結果の表示
    console.log(result);

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // よくあるエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecDUPLICATE')) {
        console.error('💡 ヒント: 指定された資格情報は既に承認されています');
      } else if (error.message.includes('tecEXPIRED')) {
        console.error(
          '💡 ヒント: 指定された資格情報の有効期限が過去の時点になっています',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error(
          '💡 ヒント: 指定された資格情報がレジャー上に存在しません',
        );
      } else if (error.message.includes('temINVALID_ACCOUNT_ID')) {
        console.error('💡 ヒント: 提供されたIssuerフィールドが無効です');
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
  credentialAccept().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
