import {
  Client,
  Wallet,
  dropsToXrp,
  rippleTimeToISOTime,
  isoTimeToRippleTime,
} from 'xrpl';
import type { EscrowFinish, Transaction, TxResponse } from 'xrpl';
import type Escrow from 'xrpl/dist/npm/models/ledger/Escrow';
import { getNetworkUrl } from '../../config/network';
import { env } from '../../config/env';
import { validateTransactionResult } from '../../lib/validateTransaction';
import { logExplorerUrl } from '../../lib/logger';
// @ts-ignore - five-bells-condition has no type definitions
import * as cc from 'five-bells-condition';

/**
 * 条件付きXRPエスクローを完了するスクリプト
 *
 * このスクリプトは暗号条件（PREIMAGE-SHA-256）を使用した条件付きエスクローを完了します：
 * 1. エスクロー作成時に生成されたFulfillmentを提供
 * 2. FinishAfter時間が経過していることを確認
 * 3. 正しいFulfillmentでエスクローを完了
 * 4. 受取人にXRPが送信される
 *
 * ⚠️ 重要: このスクリプトを実行する前に、エスクロー作成時に生成された
 *          Fulfillmentを準備してください。
 */

async function finishConditionalEscrow(): Promise<boolean> {
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
      console.log('❌ 完了可能な条件付きエスクローが見つかりません');
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

    if (isNaN(finishAfterRippleTime)) {
      console.log('⏰ 利用可能時間: 即座に利用可能（FinishAfter未設定）');
    } else {
      const finishAfterISO = rippleTimeToISOTime(finishAfterRippleTime);
      console.log(
        `⏰ 利用可能時間: ${new Date(finishAfterISO).toLocaleString()}`,
      );
    }

    // 条件付きエスクローかどうか確認
    if (!latestEscrow.Condition) {
      console.log('❌ このエスクローは条件付きエスクローではありません');
      console.log(
        '💡 通常のエスクロー完了には escrowFinish.ts を使用してください',
      );
      return false;
    }

    console.log(`🔐 条件: PREIMAGE-SHA-256`);

    // 現在時刻をRipple Epochに変換して比較
    const currentTime = isoTimeToRippleTime(new Date().toISOString());

    if (!isNaN(finishAfterRippleTime) && currentTime < finishAfterRippleTime) {
      const remainingTime = finishAfterRippleTime - currentTime;
      const finishAfterISO = rippleTimeToISOTime(finishAfterRippleTime);
      console.log(`⏳ 条件付きエスクローはまだ利用可能ではありません`);
      console.log(
        `⏰ 残り時間: ${remainingTime}秒 (${new Date(finishAfterISO).toLocaleString()})`,
      );
      return false;
    }

    console.log('✅ 条件付きエスクローが利用可能です');

    // 実際のアプリケーションでは、コマンドライン引数やファイルから読み込むことを推奨
    // このサンプルでは、エスクロー作成時に生成されたFulfillmentを使用
    // 注意: このFulfillmentはエスクロー作成時に生成されたものと一致する必要があります

    // デモ用: エスクロー作成時に使用されたのと同じpreimageからFulfillmentを再生成
    // 実際の使用時は、エスクロー作成時に生成されたFulfillmentを保存して使用してください

    // ⚠️ 重要: 以下のpreimageは、conditionalEscrowCreate.tsを実行した際に
    //          コンソールに表示された「Preimage」の値に置き換えてください
    const preimageData = Buffer.from(
      'MY_PREIMAGE_HERE', // conditionalEscrowCreate.tsで生成されたpreimageを使用
      'hex',
    );
    const myFulfillment = new (cc as any).PreimageSha256();
    myFulfillment.setPreimage(preimageData);
    const fulfillment = myFulfillment
      .serializeBinary()
      .toString('hex')
      .toUpperCase();

    console.log(`🔑 使用するFulfillment: ${fulfillment}`);
    console.log(`🔒 エスクローのCondition: ${latestEscrow.Condition}`);

    // エスクローを作成したトランザクションを取得してSequenceを取得
    const createTx: TxResponse<Transaction> = await client.request({
      command: 'tx',
      transaction: latestEscrow.PreviousTxnID,
    });

    const offerSequence = createTx.result.tx_json.Sequence!;
    console.log(`🔢 エスクローシーケンス: ${offerSequence}`);
    console.log(`👤 エスクロー作成者: ${latestEscrow.Account}`);
    console.log(`📥 受取人: ${latestEscrow.Destination}`);

    // エスクロー完了トランザクション
    // Account: エスクロー完了を実行するアカウント（受取人）
    // Owner: エスクローを作成したアカウント
    const escrowFinish: EscrowFinish = {
      TransactionType: 'EscrowFinish',
      Account: latestEscrow.Destination, // 受取人がエスクロー完了を実行
      Owner: latestEscrow.Account, // エスクローを作成したアカウント
      OfferSequence: offerSequence,
      Condition: latestEscrow.Condition, // 条件を指定
      Fulfillment: fulfillment, // Fulfillmentを指定
    };

    console.log('📝 条件付きエスクロー完了トランザクションを送信しています...');
    console.log(`👤 完了実行者: ${latestEscrow.Destination}`);

    // トランザクションの送信
    const response = await client.submitAndWait(escrowFinish, {
      wallet: recipient,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ 条件付きエスクローが正常に完了しました！');
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
        console.error(
          '💡 エスクロー作成時に生成された正しいFulfillmentを使用してください。',
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
  finishConditionalEscrow().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
