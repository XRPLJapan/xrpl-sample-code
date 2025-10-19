import { Client, type MPTokenAuthorize, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

// 発行者がユーザーを認可する関数
export async function mptokenAuthorizeByIssuer(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔐 発行者がユーザーを認可します...');
    console.log(`発行者アドレス: ${issuer.address}`);
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

    // 発行者がユーザーを認可する
    // ※ mptokenIssuanceCreate.ts で tfMPTRequireAuth フラグを有効にした場合、
    //    ユーザーがトークンを受け取る前に、発行者による認可が必要です
    const issuerAuthTx: MPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: issuer.address, // 発行者アドレス
      MPTokenIssuanceID: mptIssuanceID, // MPトークンID
      Holder: user.address, // 認可するユーザーアドレス
      // Flags: MPTokenAuthorizeFlags.tfMPTUnauthorize, // 認可を取り消す場合に使用
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const issuerPrepared = await client.autofill(issuerAuthTx);

    // トランザクションに署名
    const issuerSigned = issuer.sign(issuerPrepared);

    // トランザクションを送信して結果を待機
    const issuerResult = await client.submitAndWait(issuerSigned.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(issuerResult);

    console.log('\n✅ 発行者による認可が完了しました');

    console.log('\n📊 認可情報:');
    console.log(`  - MPTokenIssuanceID: ${mptIssuanceID}`);
    console.log(`  - 保有者: ${user.address}`);
    console.log(`  - 発行者: ${issuer.address}`);

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(issuerResult.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // MPTokenAuthorize特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temDISABLED')) {
        console.error('💡 ヒント: MPTokensV1 Amendmentが有効ではありません');
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたMPTokenIssuanceIDが存在しません');
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: 認可する権限がありません（発行者のみが認可できます）',
        );
      } else if (error.message.includes('tecDUPLICATE')) {
        console.error('💡 ヒント: 既に認可されています');
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
  mptokenAuthorizeByIssuer().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
