import { Client, Wallet } from 'xrpl';
import type { AccountSet } from 'xrpl';
import { getNetworkUrl } from '../../config/network';
import { env } from '../../config/env';
import { validateTransactionResult } from '../../lib/validateTransaction';
import { logExplorerUrl } from '../../lib/logger';

/**
 * IOU発行者がTrustLine Lockingを有効化するスクリプト
 *
 * このスクリプトは、IOU発行者アカウントに`lsfAllowTrustLineLocking`フラグを設定します。
 * このフラグを設定することで、発行したIOUトークンをエスクローで使用できるようになります。
 *
 * 🔐 asfAllowTrustLineLocking (17):
 * - このアカウントが発行したIOUトークンをエスクローで保持できるようにする
 * - TokenEscrow Amendmentが必要
 * - 発行者アカウントのみが有効化できる
 * - 一度有効化すると、保有者はこのトークンでエスクローを作成可能
 *
 * ⚠️ 重要:
 * - このフラグは**IOU Tokens（Trust Line Tokens）専用**
 * - MPTの場合は、`MPTokenIssuance`の`tfMPTCanEscrow`フラグを使用
 * - このフラグが設定されていない場合、IOUエスクローは`tecNO_PERMISSION`で失敗
 *
 * 📚 参考: https://xls.xrpl.org/xls/XLS-0085-token-escrow.html
 */

async function enableTrustLineLocking() {
  // ネットワーク接続
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    await client.connect();
    console.log('🚀 XRP Ledgerに接続しました');

    // 発行者ウォレットの初期化
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);

    console.log(`🏦 発行者アカウント: ${issuer.address}`);

    // 現在のアカウント設定を確認
    const accountInfo = await client.request({
      command: 'account_info',
      account: issuer.address,
    });

    const currentFlags = accountInfo.result.account_data.Flags;
    const lsfAllowTrustLineLocking = 0x40000000; // 1073741824

    console.log(`🔍 現在のアカウントフラグ: ${currentFlags}`);

    // lsfAllowTrustLineLockingが既に設定されているか確認
    if ((currentFlags & lsfAllowTrustLineLocking) !== 0) {
      console.log('✅ TrustLine Lockingは既に有効化されています');
      console.log(
        '💡 このアカウントが発行したIOUは既にエスクローで使用可能です',
      );
      return;
    }

    console.log('📝 TrustLine Lockingを有効化しています...');

    // AccountSetトランザクション
    // asfAllowTrustLineLocking = 17
    const accountSet: AccountSet = {
      TransactionType: 'AccountSet',
      Account: issuer.address,
      SetFlag: 17, // asfAllowTrustLineLocking
    };

    console.log('📤 AccountSetトランザクションを送信しています...');

    // トランザクションの送信
    const response = await client.submitAndWait(accountSet, {
      wallet: issuer,
    });

    // 結果の検証
    validateTransactionResult(response);

    console.log('✅ TrustLine Lockingが正常に有効化されました！');
    console.log(`🔗 トランザクションハッシュ: ${response.result.hash}`);
    logExplorerUrl(response.result.hash);

    // 更新後のアカウント設定を確認
    const updatedAccountInfo = await client.request({
      command: 'account_info',
      account: issuer.address,
    });

    const updatedFlags = updatedAccountInfo.result.account_data.Flags;
    console.log(`🔍 更新後のアカウントフラグ: ${updatedFlags}`);

    // lsfAllowTrustLineLockingが設定されたことを確認
    if ((updatedFlags & lsfAllowTrustLineLocking) !== 0) {
      console.log('✅ lsfAllowTrustLineLocking フラグが設定されました');
      console.log(
        '💡 このアカウントが発行したIOUをエスクローで使用できるようになりました',
      );
    }

    console.log('\n📝 次のステップ:');
    console.log('1. ユーザーにIOUを送金');
    console.log('2. ユーザーがIOUでエスクローを作成可能:');
    console.log('   npx tsx src/xrpl/Escrow/tokenEscrowCreate.ts');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    if (error instanceof Error) {
      if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 権限がありません。発行者アカウントで実行してください。',
        );
      } else if (error.message.includes('tecINVALID_FLAG')) {
        console.error(
          '💡 無効なフラグです。asfAllowTrustLineLocking (17)を指定してください。',
        );
      } else if (error.message.includes('temDISABLED')) {
        console.error('💡 TokenEscrow Amendmentが有効化されていません。');
        console.error(
          '   このネットワークではトークンエスクロー機能が利用できない可能性があります。',
        );
      }
    }
  } finally {
    await client.disconnect();
    console.log('👋 接続を終了しました');
  }
}

// スクリプト実行
enableTrustLineLocking().catch(console.error);
