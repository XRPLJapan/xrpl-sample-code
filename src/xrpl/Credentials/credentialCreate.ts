import {
  Client,
  Wallet,
  convertStringToHex,
  isoTimeToRippleTime,
  type CredentialCreate,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';

export async function credentialCreate(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // 有効期限を1年後に設定する
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const expirationTime = isoTimeToRippleTime(oneYearFromNow.toISOString());

    // CredentialCreateトランザクションの準備
    const tx: CredentialCreate = {
      TransactionType: 'CredentialCreate',
      Account: issuer.address,
      Subject: user.address,
      CredentialType: convertStringToHex('VerifiedAccount'), // 資格情報タイプ
      Expiration: expirationTime, // 有効期限
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = issuer.sign(prepared);

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

    console.log('✅ Credential作成が完了しました');

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
        console.error(
          '💡 ヒント: 同じSubject、Issuer、およびCredentialTypeを持つCredentialがすでに存在しています',
        );
      } else if (error.message.includes('tecEXPIRED')) {
        console.error(
          '💡 ヒント: Credentialの有効期限に過去の日時が設定されています',
        );
      } else if (error.message.includes('tecNO_TARGET')) {
        console.error(
          '💡 ヒント: Subjectフィールドで指定されたアカウントがレジャーで資金提供されていません',
        );
      } else if (error.message.includes('temINVALID_ACCOUNT_ID')) {
        console.error('💡 ヒント: 提供されたSubjectフィールドが無効です');
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
  credentialCreate().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
