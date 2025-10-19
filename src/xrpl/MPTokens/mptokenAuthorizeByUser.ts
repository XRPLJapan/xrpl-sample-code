import { Client, type MPTokenAuthorize, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

// ユーザー自身がMPTokenの保有を承認する関数
export async function mptokenAuthorizeByUser(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔐 ユーザーがMPTokenの保有を承認します...');
    console.log(`ユーザーアドレス: ${user.address}`);

    // 環境変数からMPTokenIssuanceIDを取得
    const mptIssuanceID = env.MPT_ISSUANCE_ID || '';

    if (!mptIssuanceID) {
      console.error('\n❌ MPTokenIssuanceIDが設定されていません');
      console.error(
        '💡 ヒント: mptokenIssuanceCreate.ts を実行して取得したMPTokenIssuanceIDを設定してください',
      );
      return false;
    }

    // ユーザー自身が保有を承認する
    const userAuthTx: MPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: user.address, // 保有者アドレス
      MPTokenIssuanceID: mptIssuanceID, // MPトークンID
      // Flags: MPTokenAuthorizeFlags.tfMPTUnauthorize, // 認可を取り消す場合に使用
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const userPrepared = await client.autofill(userAuthTx);

    // トランザクションに署名
    const userSigned = user.sign(userPrepared);

    // トランザクションを送信して結果を待機
    const userResult = await client.submitAndWait(userSigned.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(userResult);

    console.log('\n✅ ユーザーの保有承認が完了しました');

    console.log('\n📊 承認情報:');
    console.log(`  - MPTokenIssuanceID: ${mptIssuanceID}`);
    console.log(`  - 保有者: ${user.address}`);

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(userResult.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // MPTokenAuthorize特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temDISABLED')) {
        console.error('💡 ヒント: MPTokensV1 Amendmentが有効ではありません');
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたMPTokenIssuanceIDが存在しません');
      } else if (error.message.includes('tecDUPLICATE')) {
        console.error('💡 ヒント: 既に承認されています');
      } else if (error.message.includes('tecINSUFFICIENT_RESERVE')) {
        console.error(
          '💡 ヒント: トランザクション実行後にアカウントの準備金要件を満たせません',
        );
      } else if (error.message.includes('temMALFORMED')) {
        console.error('💡 ヒント: トランザクションが正しく指定されていません');
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
  mptokenAuthorizeByUser().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
