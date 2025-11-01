import { Client, type Payment, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function mptokenPayment(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('💸 MPTokenを送金します...');
    console.log(`送信者アドレス: ${issuer.address}`);
    console.log(`受信者アドレス: ${user.address}`);

    // 環境変数からMPTokenIssuanceIDを取得
    const mptIssuanceID = env.MPT_ISSUANCE_ID || '';

    if (!mptIssuanceID) {
      console.error('\n❌ MPTokenIssuanceIDが設定されていません');
      console.error(
        '💡 ヒント: mptokenIssuanceCreate.ts を実行して取得したMPTokenIssuanceIDを設定してください',
      );
      return false;
    }

    // MPToken送金トランザクションの準備
    const tx: Payment = {
      TransactionType: 'Payment',
      Account: issuer.address, // 送信者アドレス
      Destination: user.address, // 受信者アドレス
      Amount: {
        mpt_issuance_id: mptIssuanceID, // MPTのIssuanceID
        value: '100', // 送金量
      },
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = issuer.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ MPToken送金が完了しました');

    // 残高確認（ledger_entryで直接MPTokenオブジェクトを取得）
    try {
      const mptokenEntry = await client.request({
        command: 'ledger_entry',
        mptoken: {
          mpt_issuance_id: mptIssuanceID,
          account: user.address,
        },
        ledger_index: 'validated',
      });

      console.log('\n💰 受信者のMPToken残高:');
      if ('node' in mptokenEntry.result) {
        const mptBalance = mptokenEntry.result.node as unknown as {
          MPTokenIssuanceID: string;
          MPTAmount: string;
        };
        console.log(`  - MPTokenIssuanceID: ${mptBalance.MPTokenIssuanceID}`);
        console.log(`    残高: ${mptBalance.MPTAmount}`);
      } else {
        console.log('  - MPTokenが見つかりませんでした');
      }
    } catch (balanceError) {
      console.log(
        '\n⚠️  残高取得に失敗しました（MPTokenがまだ作成されていない可能性があります）:',
        balanceError,
      );
    }

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // Payment（MPToken）特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecNO_AUTH')) {
        console.error('💡 ヒント: 受信者がMPTokenの保有を認可されていません');
        console.error(
          '   mptokenAuthorizeByUser.ts または mptokenAuthorizeByIssuer.ts を実行して認可してください',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたMPTokenIssuanceIDが存在しません');
      } else if (error.message.includes('tecINSUFFICIENT_RESERVE')) {
        console.error(
          '💡 ヒント: トランザクション実行後にアカウントの準備金要件を満たせません',
        );
      } else if (error.message.includes('temMALFORMED')) {
        console.error('💡 ヒント: トランザクションが正しく指定されていません');
      } else if (error.message.includes('tecOBJECT_NOT_FOUND')) {
        console.error('💡 ヒント: 指定されたMPTokenIssuanceIDが存在しません');
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
  mptokenPayment().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
