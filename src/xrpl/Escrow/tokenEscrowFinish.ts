import { Client, Wallet, rippleTimeToISOTime, isoTimeToRippleTime } from 'xrpl';
import type { EscrowFinish, Transaction, TxResponse } from 'xrpl';
import type { AccountLinesTrustline } from 'xrpl/dist/npm/models/methods/accountLines';
import { getNetworkUrl } from '../../config/network';
import { env } from '../../config/env';
import { validateTransactionResult } from '../../lib/validateTransaction';
import { logExplorerUrl } from '../../lib/logger';

/**
 * トークンエスクローを完了するスクリプト
 *
 * このスクリプトは以下の条件でトークンエスクローを完了します：
 * - 時間ベースエスクロー: FinishAfter時間が経過している
 * - 条件付きエスクロー: 正しいfulfillmentを提供
 * - 組み合わせエスクロー: 時間と条件の両方が満たされている
 *
 * 注意: トークンエスクローの場合、受取人のTrustLineが自動作成される場合があります
 */

async function finishTokenEscrow(): Promise<boolean> {
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
      console.log('❌ 完了可能なトークンエスクローが見つかりません');
      console.log(
        '💡 エスクローが存在するか、FinishAfter時間が経過しているか確認してください',
      );
      return false;
    }

    // 最新のエスクローを取得
    const latestEscrow = escrowObjects.result.account_objects[0]! as any; // Token escrow has Amount as object
    const escrowId = latestEscrow.index;

    console.log(`📋 エスクローID: ${escrowId}`);
    console.log(
      `💰 金額: ${latestEscrow.Amount.value} ${latestEscrow.Amount.currency}`,
    );
    console.log(`🏦 発行者: ${latestEscrow.Amount.issuer}`);

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
      console.log(`⏳ トークンエスクローはまだ利用可能ではありません`);
      console.log(
        `⏰ 残り時間: ${remainingTime}秒 (${new Date(finishAfterISO).toLocaleString()})`,
      );
      return false;
    }

    console.log('✅ トークンエスクローが利用可能です');

    // 受取人のTrustLineを確認
    const trustLines = await client.request({
      command: 'account_lines',
      account: recipient.address,
    });

    const existingTrustLine = trustLines.result.lines.find(
      (line: AccountLinesTrustline) =>
        line.currency === latestEscrow.Amount.currency &&
        line.account === latestEscrow.Amount.issuer,
    );

    if (!existingTrustLine) {
      console.log('⚠️  受取人にTrustLineが存在しません');
      console.log(
        '💡 トークンエスクロー完了時にTrustLineが自動作成される場合があります',
      );
    } else {
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

    // エスクロー完了トランザクション
    const escrowFinish: EscrowFinish = {
      TransactionType: 'EscrowFinish',
      Account: recipient.address,
      Owner: latestEscrow.Account, // エスクローを作成したアカウント
      OfferSequence: offerSequence,
    };

    // 条件付きエスクローの場合、Fulfillmentを追加
    if (latestEscrow.Condition) {
      console.log('🔐 条件付きトークンエスクローです');
      console.log(
        '⚠️  Fulfillmentが必要ですが、このサンプルでは条件なしエスクローのみサポートしています',
      );
      console.log(
        '💡 条件付きエスクローの場合は、正しいFulfillmentを提供してください',
      );
      return false;
    }

    console.log('📝 トークンエスクロー完了トランザクションを送信しています...');

    // トランザクションの送信
    const response = await client.submitAndWait(escrowFinish, {
      wallet: recipient,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ トークンエスクローが正常に完了しました！');
    console.log(`🔗 トランザクションハッシュ: ${response.result.hash}`);
    logExplorerUrl(response.result.hash);

    // 受取人のTrustLine残高確認
    const updatedTrustLines = await client.request({
      command: 'account_lines',
      account: recipient.address,
    });

    const updatedTrustLine = updatedTrustLines.result.lines.find(
      (line: AccountLinesTrustline) =>
        line.currency === latestEscrow.Amount.currency &&
        line.account === latestEscrow.Amount.issuer,
    );

    if (updatedTrustLine) {
      console.log(
        `💰 受取人の新しいTrustLine残高: ${updatedTrustLine.balance} ${latestEscrow.Amount.currency}`,
      );
    } else {
      console.log('⚠️  TrustLineが見つかりません。認証が必要な場合があります。');
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
      } else if (error.message.includes('tecNO_LINE')) {
        console.error(
          '💡 TrustLineが存在しません。認証が必要な場合があります。',
        );
      } else if (error.message.includes('tecNO_AUTH')) {
        console.error('💡 認証が必要です。発行者による事前認証が必要です。');
      } else if (error.message.includes('tecFROZEN')) {
        console.error(
          '💡 トークンが凍結されています。発行者に確認してください。',
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
  finishTokenEscrow().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
