import {
  Client,
  Wallet,
  dropsToXrp,
  rippleTimeToISOTime,
  isoTimeToRippleTime,
} from 'xrpl';
import type { EscrowCancel, Transaction, TxResponse } from 'xrpl';
import type Escrow from 'xrpl/dist/npm/models/ledger/Escrow';
import { getNetworkUrl } from '../../config/network';
import { env } from '../../config/env';
import { validateTransactionResult } from '../../lib/validateTransaction';
import { logExplorerUrl } from '../../lib/logger';

/**
 * XRPエスクローをキャンセルするスクリプト
 *
 * このスクリプトは以下の条件でエスクローをキャンセルします：
 * - 期限切れエスクロー（CancelAfter時間が経過）
 * - 誰でもキャンセル可能（期限切れ後）
 */

async function cancelEscrow(): Promise<boolean> {
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
      console.log('❌ キャンセル可能なエスクローが見つかりません');
      console.log(
        '💡 エスクローが存在するか、CancelAfter時間が経過しているか確認してください',
      );
      return false;
    }

    // 最新のエスクローを取得
    const latestEscrow = escrowObjects.result.account_objects[0]! as Escrow;
    const escrowId = latestEscrow.index;

    console.log(`📋 エスクローID: ${escrowId}`);
    console.log(`💰 金額: ${dropsToXrp(latestEscrow.Amount)} XRP`);
    console.log(`👤 エスクロー作成者: ${latestEscrow.Account}`);
    console.log(`📥 受取人: ${latestEscrow.Destination}`);

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
      console.log(`⏳ エスクローはまだ期限切れではありません`);
      console.log(
        `⏰ 残り時間: ${remainingTime}秒 (${new Date(cancelAfterISO).toLocaleString()})`,
      );
      console.log('💡 期限切れ後にキャンセルできます');
      return false;
    }

    console.log('✅ エスクローが期限切れです。キャンセル可能です');

    // エスクローを作成したトランザクションを取得してSequenceを取得
    const createTx: TxResponse<Transaction> = await client.request({
      command: 'tx',
      transaction: latestEscrow.PreviousTxnID,
    });

    const offerSequence = createTx.result.tx_json.Sequence!;
    console.log(`🔢 エスクローシーケンス: ${offerSequence}`);

    // エスクローキャンセルトランザクション
    // Account: キャンセルを実行するアカウント（エスクロー作成者または受取人）
    // Owner: エスクローを作成したアカウント
    const escrowCancel: EscrowCancel = {
      TransactionType: 'EscrowCancel',
      Account: latestEscrow.Account, // エスクロー作成者がキャンセルを実行
      Owner: latestEscrow.Account, // エスクローを作成したアカウント
      OfferSequence: offerSequence,
    };

    console.log('📝 エスクローキャンセルトランザクションを送信しています...');
    console.log(`👤 キャンセル実行者: ${latestEscrow.Account}`);

    // エスクロー作成者のウォレットを使用
    const ownerWallet = Wallet.fromSeed(env.USER_SEED); // エスクロー作成者

    // トランザクションの送信
    const response = await client.submitAndWait(escrowCancel, {
      wallet: ownerWallet,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ エスクローが正常にキャンセルされました！');
    console.log(`🔗 トランザクションハッシュ: ${response.result.hash}`);
    logExplorerUrl(response.result.hash);

    // 送信者の残高確認
    const senderAccountInfo = await client.request({
      command: 'account_info',
      account: latestEscrow.Account, // エスクロー作成者の残高を確認
    });

    console.log(
      `💰 エスクロー作成者の新しい残高: ${dropsToXrp(senderAccountInfo.result.account_data.Balance)} XRP`,
    );
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
  cancelEscrow().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
