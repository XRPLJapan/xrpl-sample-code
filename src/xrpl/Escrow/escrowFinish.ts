import {
  Client,
  dropsToXrp,
  Wallet,
  rippleTimeToISOTime,
  isoTimeToRippleTime,
} from 'xrpl';
import type { EscrowFinish, Transaction, TxResponse } from 'xrpl';
import type Escrow from 'xrpl/dist/npm/models/ledger/Escrow';
import { getNetworkUrl } from '../../config/network';
import { env } from '../../config/env';
import { validateTransactionResult } from '../../lib/validateTransaction';
import { logExplorerUrl } from '../../lib/logger';

/**
 * XRPエスクローを完了するスクリプト
 *
 * このスクリプトは以下の条件でエスクローを完了します：
 * - 時間ベースエスクロー: FinishAfter時間が経過している
 * - 条件付きエスクロー: 正しいfulfillmentを提供
 * - 組み合わせエスクロー: 時間と条件の両方が満たされている
 */

async function finishEscrow(): Promise<boolean> {
  // ネットワーク接続
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    await client.connect();
    console.log('🚀 XRP Ledgerに接続しました');

    // ウォレットの初期化
    const sender = Wallet.fromSeed(env.USER_SEED);
    const recipient = Wallet.fromSeed(env.ISUEER_SEED);

    console.log(`📤 送信者: ${sender.address}`);
    console.log(`📥 受取人: ${recipient.address}`);

    // エスクローオブジェクトは作成者（送信者）のアカウントに保存される
    const escrowObjects = await client.request({
      command: 'account_objects',
      account: sender.address,
      type: 'escrow',
    });

    if (escrowObjects.result.account_objects.length === 0) {
      console.log('❌ 完了可能なエスクローが見つかりません');
      console.log(
        '💡 エスクローが存在するか、FinishAfter時間が経過しているか確認してください',
      );
      return false;
    }

    // 最新のエスクローを取得
    const latestEscrow = escrowObjects.result.account_objects[0]! as Escrow;
    const escrowId = latestEscrow.index;

    console.log(`📋 エスクローID: ${escrowId}`);
    console.log(`💰 金額: ${latestEscrow.Amount} drops`);

    // Ripple EpochからISO形式に変換して表示
    const finishAfterRippleTime = Number(latestEscrow.FinishAfter);
    const finishAfterISO = rippleTimeToISOTime(finishAfterRippleTime);
    console.log(
      `⏰ 利用可能時間: ${new Date(finishAfterISO).toLocaleString()}`,
    );

    // 現在時刻をRipple Epochに変換して比較
    const currentTime = isoTimeToRippleTime(new Date().toISOString());

    if (currentTime < finishAfterRippleTime) {
      const remainingTime = finishAfterRippleTime - currentTime;
      console.log(`⏳ エスクローはまだ利用可能ではありません`);
      console.log(
        `⏰ 残り時間: ${remainingTime}秒 (${new Date(finishAfterISO).toLocaleString()})`,
      );
      return false;
    }

    console.log('✅ エスクローが利用可能です');

    // エスクローを作成したトランザクションを取得してSequenceを取得
    const createTx: TxResponse<Transaction> = await client.request({
      command: 'tx',
      transaction: latestEscrow.PreviousTxnID,
    });

    const offerSequence = createTx.result.tx_json.Sequence!;
    console.log(`🔢 エスクローシーケンス: ${offerSequence as number}`);

    // エスクロー完了トランザクション
    // Account: エスクロー完了を実行するアカウント（受取人）
    // Owner: エスクローを作成したアカウント
    const escrowFinish: EscrowFinish = {
      TransactionType: 'EscrowFinish',
      Account: recipient.address, // 受取人がエスクロー完了を実行
      Owner: latestEscrow.Account, // エスクローを作成したアカウント
      OfferSequence: offerSequence,
    };

    // 条件付きエスクローの場合、Fulfillmentを追加
    if (latestEscrow.Condition) {
      console.log('🔐 条件付きエスクローです');
      console.log(
        '⚠️  Fulfillmentが必要ですが、このサンプルでは条件なしエスクローのみサポートしています',
      );
      console.log(
        '💡 条件付きエスクローの場合は、正しいFulfillmentを提供してください',
      );
      return false;
    }

    console.log('📝 エスクロー完了トランザクションを送信しています...');
    console.log(`👤 完了実行者: ${recipient.address}`);

    // トランザクションの送信
    const response = await client.submitAndWait(escrowFinish, {
      wallet: recipient,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ エスクローが正常に完了しました！');
    console.log(`🔗 トランザクションハッシュ: ${response.result.hash}`);
    logExplorerUrl(response.result.hash);

    // 受取人の残高確認
    const recipientAccountInfo = await client.request({
      command: 'account_info',
      account: recipient.address,
    });

    console.log(
      `💰 受取人の新しい残高: ${dropsToXrp(recipientAccountInfo.result.account_data.Balance)} XRP`,
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
          '💡 権限がありません。受取人アカウントで実行してください。',
        );
      } else if (error.message.includes('tecCRYPTOCONDITION_ERROR')) {
        console.error(
          '💡 暗号条件エラーです。Fulfillmentが正しくない可能性があります。',
        );
      } else if (error.message.includes('tecINVALID_ACCOUNT')) {
        console.error(
          '💡 無効なアカウントです。アカウント情報を確認してください。',
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
  finishEscrow().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
