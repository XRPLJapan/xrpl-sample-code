import { Client, Wallet, rippleTimeToISOTime, isoTimeToRippleTime } from 'xrpl';
import type { EscrowCancel, Transaction, TxResponse } from 'xrpl';
import type { AccountLinesTrustline } from 'xrpl/dist/npm/models/methods/accountLines';
import { getNetworkUrl } from '../../config/network';
import { env } from '../../config/env';
import { validateTransactionResult } from '../../lib/validateTransaction';
import { logExplorerUrl } from '../../lib/logger';

/**
 * トークンエスクローをキャンセルするスクリプト
 *
 * このスクリプトは以下の条件でトークンエスクローをキャンセルします：
 * - 期限切れエスクロー（CancelAfter時間が経過）
 * - 誰でもキャンセル可能（期限切れ後）
 *
 * ⏰ FinishAfter（利用可能時間）:
 * - エスクローが完了可能になる時間を指定
 * - トークンエスクローでは**必須**
 * - Rippleエポック（2000-01-01 00:00 UTCからの秒数）形式
 * - rippleTimeToISOTime()を使用してISO 8601形式に変換
 *
 * ⏳ CancelAfter（期限時間）:
 * - エスクローが期限切れになる時間を指定
 * - トークンエスクローでは**必須**
 * - Rippleエポック（2000-01-01 00:00 UTCからの秒数）形式
 * - FinishAfterより後の時間を指定する必要がある
 * - rippleTimeToISOTime()を使用してISO 8601形式に変換
 *
 * 注意: トークンエスクローには期限（CancelAfter）が必須です
 */

async function cancelTokenEscrow(): Promise<boolean> {
  // ネットワーク接続
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    await client.connect();
    console.log('🚀 XRP Ledgerに接続しました');

    // ウォレットの初期化
    const sender = Wallet.fromSeed(env.USER_SEED);

    console.log(`📤 送信者: ${sender.address}`);

    // アカウントのエスクローオブジェクトを取得
    const escrowObjects = await client.request({
      command: 'account_objects',
      account: sender.address,
      type: 'escrow',
    });

    if (escrowObjects.result.account_objects.length === 0) {
      console.log('❌ キャンセル可能なトークンエスクローが見つかりません');
      console.log(
        '💡 エスクローが存在するか、CancelAfter時間が経過しているか確認してください',
      );
      return false;
    }

    // 最新のエスクローを取得
    const latestEscrow = escrowObjects.result.account_objects[0]! as any; // Token escrow has Amount as object

    if (
      latestEscrow &&
      'Amount' in latestEscrow &&
      'FinishAfter' in latestEscrow &&
      'CancelAfter' in latestEscrow
    ) {
      console.log('📋 最新のトークンエスクロー情報:');
      console.log(`   - エスクローID: ${latestEscrow.index}`);
      console.log(
        `   - 金額: ${latestEscrow.Amount.value} ${latestEscrow.Amount.currency}`,
      );
      console.log(`   - 発行者: ${latestEscrow.Amount.issuer}`);
      console.log(`   - 受取人: ${latestEscrow.Destination}`);
    }

    // Ripple EpochからISO形式に変換して表示
    const finishAfterRippleTime = Number(latestEscrow.FinishAfter);
    const finishAfterISO = rippleTimeToISOTime(finishAfterRippleTime);
    console.log(
      `⏰ 利用可能時間: ${new Date(finishAfterISO).toLocaleString()}`,
    );

    const cancelAfterRippleTime = Number(latestEscrow.CancelAfter);
    const cancelAfterISO = rippleTimeToISOTime(cancelAfterRippleTime);
    console.log(`⏳ 期限: ${new Date(cancelAfterISO).toLocaleString()}`);

    // 現在時刻をRipple Epochに変換して比較
    const currentTime = isoTimeToRippleTime(new Date().toISOString());

    if (currentTime < cancelAfterRippleTime) {
      const remainingTime = cancelAfterRippleTime - currentTime;
      console.log(`⏳ トークンエスクローはまだ期限切れではありません`);
      console.log(
        `⏰ 残り時間: ${remainingTime}秒 (${new Date(cancelAfterISO).toLocaleString()})`,
      );
      console.log('💡 期限切れ後にキャンセルできます');
      return false;
    }

    console.log('✅ トークンエスクローが期限切れです。キャンセル可能です');

    // 送信者のTrustLine残高を確認
    const trustLines = await client.request({
      command: 'account_lines',
      account: sender.address,
    });

    const existingTrustLine = trustLines.result.lines.find(
      (line: AccountLinesTrustline) =>
        line.currency === latestEscrow.Amount.currency &&
        line.account === latestEscrow.Amount.issuer,
    );

    if (existingTrustLine) {
      console.log(
        `💎 現在のTrustLine残高: ${existingTrustLine.balance} ${latestEscrow.Amount.currency}`,
      );
    }

    // エスクローを作成したトランザクションを取得してSequenceを取得
    const createTx: TxResponse<Transaction> = await client.request({
      command: 'tx',
      transaction: latestEscrow.PreviousTxnID,
    });

    const offerSequence = createTx.result.tx_json.Sequence!;
    console.log(`🔢 エスクローシーケンス: ${offerSequence}`);

    // エスクローキャンセルトランザクション
    const escrowCancel: EscrowCancel = {
      TransactionType: 'EscrowCancel',
      Account: sender.address,
      Owner: latestEscrow.Account, // エスクローを作成したアカウント
      OfferSequence: offerSequence,
    };

    console.log(
      '📝 トークンエスクローキャンセルトランザクションを送信しています...',
    );

    // トランザクションの送信
    const response = await client.submitAndWait(escrowCancel, {
      wallet: sender,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ トークンエスクローが正常にキャンセルされました！');
    console.log(`🔗 トランザクションハッシュ: ${response.result.hash}`);
    logExplorerUrl(response.result.hash);

    // 送信者のTrustLine残高確認
    const updatedTrustLines = await client.request({
      command: 'account_lines',
      account: sender.address,
    });

    const updatedTrustLine = updatedTrustLines.result.lines.find(
      (line: AccountLinesTrustline) =>
        line.currency === latestEscrow.Amount.currency &&
        line.account === latestEscrow.Amount.issuer,
    );

    if (updatedTrustLine) {
      console.log(
        `💰 送信者の新しいTrustLine残高: ${updatedTrustLine.balance} ${latestEscrow.Amount.currency}`,
      );
    } else {
      console.log('⚠️  TrustLineが見つかりません。');
    }
    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    if (error instanceof Error) {
      if (error.message.includes('tecNO_ENTRY')) {
        console.error(
          '💡 エスクローが見つかりません。エスクローIDを確認してください。',
        );
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 権限がありません。期限切れエスクローは誰でもキャンセルできます。',
        );
      } else if (error.message.includes('tecINVALID_ACCOUNT')) {
        console.error(
          '💡 無効なアカウントです。アカウント情報を確認してください。',
        );
      } else if (error.message.includes('tecNO_ESCROW')) {
        console.error(
          '💡 エスクローが存在しません。既に完了またはキャンセルされている可能性があります。',
        );
      } else if (error.message.includes('tecNO_LINE')) {
        console.error('💡 TrustLineが存在しません。');
      } else if (error.message.includes('tecFROZEN')) {
        console.error(
          '💡 トークンが凍結されています。発行者に確認してください。',
        );
      } else if (error.message.includes('temBAD_EXPIRATION')) {
        console.error('💡 期限設定が無効です。未来の時間を指定してください。');
      }
    }
    return false;
  } finally {
    await client.disconnect();
    console.log('👋 接続を終了しました');
  }
}

// スクリプトが直接実行された場合の処理
if (import.meta.url === `file://${process.argv[1]}`) {
  cancelTokenEscrow().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
