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

/**
 * XRPエスクローを作成するスクリプト
 *
 * このスクリプトは以下の3つのタイプのエスクローをサポートします：
 * 1. Time-based Escrow: 指定時間後に利用可能
 * 2. Conditional Escrow: 暗号条件を満たした時に利用可能
 * 3. Combination Escrow: 時間と条件の両方を指定
 *
 * ⏰ FinishAfter（利用可能時間）:
 * - エスクローが完了可能になる時間を指定
 * - オプション（指定しない場合、即座に完了可能）
 * - Rippleエポック（2000-01-01 00:00 UTCからの秒数）形式
 * - isoTimeToRippleTime()を使用してISO 8601形式から変換
 *
 * ⏳ CancelAfter（期限時間）:
 * - エスクローが期限切れになる時間を指定
 * - XRPエスクローでは**オプション**（指定しない場合、期限なし）
 * - Rippleエポック（2000-01-01 00:00 UTCからの秒数）形式
 * - FinishAfterより後の時間を指定する必要がある
 * - isoTimeToRippleTime()を使用してISO 8601形式から変換
 */

async function createEscrow(): Promise<boolean> {
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

    console.log(`💎 エスクロー金額: ${escrowAmount} drops (1 XRP)`);
    console.log(`⏰ 利用可能時間: ${finishAfterDate.toLocaleString()}`);
    console.log(`⏳ 期限: ${cancelAfterDate.toLocaleString()}`);
    console.log(`📅 有効期間: 60秒後から300秒後まで（4分間）`);

    // エスクロー作成トランザクション
    const escrowCreate: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: sender.address,
      Destination: recipient.address,
      Amount: escrowAmount,
      FinishAfter: finishAfter, // オプション
      CancelAfter: cancelAfter, // オプション（XRPの場合）
    };

    console.log('📝 エスクロー作成トランザクションを送信しています...');

    // トランザクションの送信
    const response = await client.submitAndWait(escrowCreate, {
      wallet: sender,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ エスクローが正常に作成されました！');
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
  createEscrow().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
