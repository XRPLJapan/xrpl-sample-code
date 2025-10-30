import { Client, Wallet, isoTimeToRippleTime, rippleTimeToISOTime } from 'xrpl';
import type { EscrowCreate } from 'xrpl';
import type { AccountLinesTrustline } from 'xrpl/dist/npm/models/methods/accountLines';
import { getNetworkUrl } from '../../config/network';
import { env } from '../../config/env';
import { validateTransactionResult } from '../../lib/validateTransaction';
import { logExplorerUrl } from '../../lib/logger';

/**
 * トークンエスクローを作成するスクリプト
 *
 * このスクリプトは以下のトークンタイプのエスクローをサポートします：
 * 1. Trust Line Tokens (IOU)
 * 2. Multi-Purpose Tokens (MPT)
 *
 * ⏰ FinishAfter（利用可能時間）:
 * - エスクローが完了可能になる時間を指定
 * - オプション（指定しない場合、即座に完了可能）
 * - Rippleエポック（2000-01-01 00:00 UTCからの秒数）形式
 *
 * ⏳ CancelAfter（期限時間）:
 * - エスクローが期限切れになる時間を指定
 * - トークンエスクローでは**必須**（指定しないとエラー）
 * - Rippleエポック（2000-01-01 00:00 UTCからの秒数）形式
 * - FinishAfterより後の時間を指定する必要がある
 *
 * ⚠️ 重要: トークンエスクローには必ずCancelAfterを指定してください。
 *          これは、トークンが永久にロックされることを防ぐための仕様です。
 */

async function createTokenEscrow(): Promise<boolean> {
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

    // 送信者のアカウント情報を取得
    const senderAccountInfo = await client.request({
      command: 'account_info',
      account: sender.address,
    });

    console.log(
      `💰 送信者のXRP残高: ${senderAccountInfo.result.account_data.Balance} XRP`,
    );

    // Trust Lineの確認
    const trustLines = await client.request({
      command: 'account_lines',
      account: sender.address,
    });

    const iouTrustLine = trustLines.result.lines.find(
      (line: AccountLinesTrustline) => line.currency === env.IOU_CURRENCY,
    );

    if (!iouTrustLine) {
      console.error('❌ IOU TrustLineが見つかりません');
      console.log('💡 先にTrustSetを実行してTrustLineを設定してください');
      return false;
    }

    console.log(`💎 IOU残高: ${iouTrustLine.balance} ${env.IOU_CURRENCY}`);

    // エスクローの設定
    const escrowAmount = '1'; // 1 IOU

    // FinishAfter: エスクローが完了可能になる時間（現在時刻から60秒後）
    // - この時間が経過するまでEscrowFinishトランザクションは失敗する
    // - オプション: 指定しない場合、即座に完了可能
    // - Ripple Epoch（2000-01-01 00:00 UTC）からの秒数で指定
    const finishAfterDate = new Date(Date.now() + 60 * 1000); // 60秒後
    const finishAfter = isoTimeToRippleTime(finishAfterDate.toISOString());

    // CancelAfter: エスクローが期限切れになる時間（現在時刻から300秒後）
    // - この時間が経過した後、EscrowCancelトランザクションで資金を送信者に返却できる
    // - トークンエスクローでは**必須**: 指定しないとエラーになる
    // - 注意: FinishAfterより後の時間を指定する必要がある
    // - Ripple Epoch（2000-01-01 00:00 UTC）からの秒数で指定
    const cancelAfterDate = new Date(Date.now() + 300 * 1000); // 300秒後
    const cancelAfter = isoTimeToRippleTime(cancelAfterDate.toISOString());

    console.log(`💎 エスクロー金額: ${escrowAmount} ${env.IOU_CURRENCY}`);
    console.log(`⏰ 利用可能時間: ${finishAfterDate.toLocaleString()}`);
    console.log(`⏳ 期限: ${cancelAfterDate.toLocaleString()}`);
    console.log(`📅 有効期間: 60秒後から300秒後まで（4分間）`);
    console.log(`⚠️  トークンエスクローではCancelAfterが必須です`);

    // トークンエスクロー作成トランザクション
    const tokenEscrowCreate: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: sender.address,
      Destination: recipient.address,
      Amount: {
        currency: env.IOU_CURRENCY,
        issuer: recipient.address, // 発行者のアドレス
        value: escrowAmount,
      },
      FinishAfter: finishAfter, // オプション
      CancelAfter: cancelAfter, // 必須（トークンエスクローの場合）
    };

    console.log('📝 トークンエスクロー作成トランザクションを送信しています...');

    // トランザクションの送信
    const response = await client.submitAndWait(tokenEscrowCreate, {
      wallet: sender,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ トークンエスクローが正常に作成されました！');
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
      const latestEscrow = escrowObjects.result.account_objects[0]! as any; // Token escrow has Amount as object
      console.log('📋 最新のトークンエスクロー情報:');
      console.log(`   - エスクローID: ${latestEscrow.index}`);
      console.log(
        `   - 金額: ${latestEscrow.Amount.value} ${latestEscrow.Amount.currency}`,
      );
      console.log(`   - 発行者: ${latestEscrow.Amount.issuer}`);
      console.log(`   - 受取人: ${latestEscrow.Destination}`);
      console.log(
        `   - 利用可能時間: ${new Date(rippleTimeToISOTime(Number(latestEscrow.FinishAfter))).toLocaleString()}`,
      );
      console.log(
        `   - 期限: ${new Date(rippleTimeToISOTime(Number(latestEscrow.CancelAfter))).toLocaleString()}`,
      );
    }
    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    if (error instanceof Error) {
      if (error.message.includes('tecUNFUNDED_PAYMENT')) {
        console.error('💡 残高不足です。十分なIOUを確保してください。');
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 権限がありません。アカウントの設定を確認してください。',
        );
      } else if (error.message.includes('temBAD_EXPIRATION')) {
        console.error('💡 期限設定が無効です。未来の時間を指定してください。');
      } else if (error.message.includes('tecNO_LINE')) {
        console.error(
          '💡 TrustLineが存在しません。先にTrustSetを実行してください。',
        );
      } else if (error.message.includes('tecNO_AUTH')) {
        console.error(
          '💡 認証が必要です。発行者による事前認証が必要な場合があります。',
        );
      } else if (error.message.includes('temBAD_AMOUNT')) {
        console.error('💡 金額が無効です。正しい金額を指定してください。');
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
  createTokenEscrow().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
