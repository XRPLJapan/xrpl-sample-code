import {
  Client,
  Wallet,
  xrpToDrops,
  dropsToXrp,
  isoTimeToRippleTime,
  rippleTimeToISOTime,
} from 'xrpl';
import type { EscrowCreate } from 'xrpl';
import type Escrow from 'xrpl/dist/npm/models/ledger/Escrow';
import { getNetworkUrl } from '../../config/network';
import { env } from '../../config/env';
import { validateTransactionResult } from '../../lib/validateTransaction';
import { logExplorerUrl } from '../../lib/logger';
import * as crypto from 'crypto';

// five-bells-conditionライブラリを動的にインポート
// @ts-ignore - five-bells-condition has no type definitions
import * as cc from 'five-bells-condition';

/**
 * 条件付きXRPエスクローを作成するスクリプト
 *
 * このスクリプトは暗号条件（PREIMAGE-SHA-256）を使用した条件付きエスクローを作成します：
 * 1. ランダムな32バイトのpreimageを生成
 * 2. 対応するConditionとFulfillmentを作成
 * 3. Conditionを使用してエスクローを作成
 * 4. Fulfillmentは安全に保存（エスクロー完了時に必要）
 *
 * ⏰ FinishAfter（利用可能時間）:
 * - エスクローが完了可能になる時間を指定
 * - オプション（指定しない場合、即座に完了可能）
 * - Rippleエポック（2000-01-01 00:00 UTCからの秒数）形式
 *
 * ⏳ CancelAfter（期限時間）:
 * - エスクローが期限切れになる時間を指定
 * - XRPエスクローでは**オプション**（指定しない場合、期限なし）
 * - Rippleエポック（2000-01-01 00:00 UTCからの秒数）形式
 * - FinishAfterより後の時間を指定する必要がある
 *
 * 🔐 Condition（暗号条件）:
 * - PREIMAGE-SHA-256タイプの暗号条件
 * - 対応するFulfillmentを提供することでエスクローを完了可能
 * - 32バイト以上のランダムデータから生成
 */

async function createConditionalEscrow(): Promise<boolean> {
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

    // アカウント情報の取得
    const senderAccountInfo = await client.request({
      command: 'account_info',
      account: sender.address,
    });

    console.log(
      `💰 送信者の残高: ${dropsToXrp(senderAccountInfo.result.account_data.Balance)} XRP`,
    );

    // 暗号条件の生成
    console.log('🔐 暗号条件を生成しています...');

    // 32バイトのランダムなpreimageを生成
    const preimageData = crypto.randomBytes(32);
    console.log(
      `🔑 Preimage（Finish時に使用）: ${preimageData.toString('hex').toUpperCase()}`,
    );

    // PreimageSha256のフルフィルメントを作成
    const myFulfillment = new cc.PreimageSha256();
    myFulfillment.setPreimage(preimageData);

    // Conditionを取得（エスクロー作成時に使用）
    const condition = myFulfillment
      .getConditionBinary()
      .toString('hex')
      .toUpperCase();
    console.log(`🔒 Condition: ${condition}`);

    // Fulfillmentを取得（エスクロー完了時に使用）
    const fulfillment = myFulfillment
      .serializeBinary()
      .toString('hex')
      .toUpperCase();
    console.log(`🔓 Fulfillment: ${fulfillment}`);

    // エスクローの設定
    const escrowAmount = xrpToDrops('1'); // 1 XRP

    // FinishAfter: エスクローが完了可能になる時間（現在時刻から60秒後）
    // - この時間が経過するまでEscrowFinishトランザクションは失敗する
    // - オプション: 指定しない場合、即座に完了可能
    // - Ripple Epoch（2000-01-01 00:00 UTC）からの秒数で指定
    const finishAfterDate = new Date(Date.now() + 60 * 1000); // 60秒後
    const finishAfter = isoTimeToRippleTime(finishAfterDate.toISOString());

    // CancelAfter: エスクローが期限切れになる時間（現在時刻から300秒後）
    // - この時間が経過した後、EscrowCancelトランザクションで資金を送信者に返却できる
    // - XRPエスクローではオプション: 指定しない場合、期限なし（永続的エスクロー）
    // - 注意: FinishAfterより後の時間を指定する必要がある
    // - Ripple Epoch（2000-01-01 00:00 UTC）からの秒数で指定
    const cancelAfterDate = new Date(Date.now() + 300 * 1000); // 300秒後
    const cancelAfter = isoTimeToRippleTime(cancelAfterDate.toISOString());

    console.log(`💎 エスクロー金額: ${escrowAmount} drops (10 XRP)`);
    console.log(`⏰ 利用可能時間: ${finishAfterDate.toLocaleString()}`);
    console.log(`⏳ 期限: ${cancelAfterDate.toLocaleString()}`);
    console.log(`📅 有効期間: 60秒後から300秒後まで（4分間）`);
    console.log(`🔐 条件: PREIMAGE-SHA-256（Fulfillmentが必要）`);

    // 条件付きエスクロー作成トランザクション
    const conditionalEscrowCreate: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: sender.address,
      Destination: recipient.address,
      Amount: escrowAmount,
      Condition: condition, // 暗号条件を指定
      FinishAfter: finishAfter, // オプション
      CancelAfter: cancelAfter, // オプション（XRPエスクローの場合）
    };

    console.log('📝 条件付きエスクロー作成トランザクションを送信しています...');

    // トランザクションの送信
    const response = await client.submitAndWait(conditionalEscrowCreate, {
      wallet: sender,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ 条件付きエスクローが正常に作成されました！');
    console.log(`🔗 トランザクションハッシュ: ${response.result.hash}`);
    logExplorerUrl(response.result.hash);

    // エスクローオブジェクトの確認
    const escrowObjects = await client.request({
      command: 'account_objects',
      account: sender.address,
      type: 'escrow',
    });

    console.log(
      `📊 作成されたエスクロー数: ${escrowObjects.result.account_objects.length}`,
    );

    if (escrowObjects.result.account_objects.length > 0) {
      const latestEscrow = escrowObjects.result.account_objects[0]! as Escrow;
      console.log('📋 最新のエスクロー情報:');
      console.log(`   - エスクローID: ${latestEscrow.index}`);
      console.log(`   - 金額: ${latestEscrow.Amount} drops`);
      console.log(`   - 受取人: ${latestEscrow.Destination}`);
      if (latestEscrow.FinishAfter) {
        console.log(
          `   - 利用可能時間: ${new Date(rippleTimeToISOTime(latestEscrow.FinishAfter)).toLocaleString()}`,
        );
      }
      if (latestEscrow.CancelAfter) {
        console.log(
          `   - 期限: ${new Date(rippleTimeToISOTime(latestEscrow.CancelAfter)).toLocaleString()}`,
        );
      }
    }

    // Fulfillmentの保存方法を説明
    console.log('\n📝 次のステップ:');
    console.log('1. 上記のFulfillmentを安全に保存してください');
    console.log('2. 60秒後（FinishAfter時間経過後）に以下のコマンドを実行:');
    console.log('   npx tsx src/xrpl/Escrow/conditionalEscrowFinish.ts');
    console.log('3. その際に保存したFulfillmentが必要です');
    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    if (error instanceof Error) {
      if (error.message.includes('tecUNFUNDED_PAYMENT')) {
        console.error('💡 残高不足です。十分なXRPを確保してください。');
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 権限がありません。アカウントの設定を確認してください。',
        );
      } else if (error.message.includes('temBAD_EXPIRATION')) {
        console.error('💡 期限設定が無効です。未来の時間を指定してください。');
      } else if (error.message.includes('temBAD_CONDITION')) {
        console.error(
          '💡 条件が無効です。正しいCondition形式を指定してください。',
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
  createConditionalEscrow().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
