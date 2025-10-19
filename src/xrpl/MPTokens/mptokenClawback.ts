import { type Clawback, Client, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function mptokenClawback(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔙 MPTokenをClawback（取り戻し）します...');
    console.log(`発行者アドレス: ${issuer.address}`);
    console.log(`保有者アドレス: ${user.address}`);

    // 環境変数からMPTokenIssuanceIDを取得
    const mptIssuanceID = env.MPT_ISSUANCE_ID || '';

    if (!mptIssuanceID) {
      console.error('\n❌ MPTokenIssuanceIDが設定されていません');
      console.error(
        '💡 ヒント: mptokenIssuanceCreate.ts を実行して取得したMPTokenIssuanceIDを設定してください',
      );
      return false;
    }

    // 保有者の残高を確認
    console.log('\n💰 Clawback前の保有者残高を確認...');
    try {
      const holderBalance = await client.request({
        command: 'account_objects',
        account: user.address,
        ledger_index: 'validated',
      });
      if ('account_objects' in holderBalance.result) {
        const mptBalances = holderBalance.result.account_objects.filter(
          (obj) => {
            const ledgerObj = obj as {
              LedgerEntryType: string;
              MPTokenIssuanceID?: string;
            };
            return (
              ledgerObj.LedgerEntryType === 'MPToken' &&
              ledgerObj.MPTokenIssuanceID === mptIssuanceID
            );
          },
        );
        if (mptBalances.length > 0) {
          const mptBalance = mptBalances[0] as unknown as {
            MPTokenIssuanceID: string;
            MPTAmount: string;
          };
          console.log(`  - MPTokenIssuanceID: ${mptBalance.MPTokenIssuanceID}`);
          console.log(`    残高: ${mptBalance.MPTAmount}`);
        } else {
          console.log('  - 該当するMPToken残高がありません');
        }
      }
    } catch (balanceError) {
      console.log('⚠️  残高取得に失敗しました:', balanceError);
    }

    // Clawbackトランザクションの準備
    const tx: Clawback = {
      TransactionType: 'Clawback',
      Account: issuer.address, // 発行者アドレス（トークンを取り戻す側）
      Holder: user.address, // 保有者アドレス（トークンを取り戻される側）
      Amount: {
        mpt_issuance_id: mptIssuanceID, // MPT Issuance ID
        value: '100', // 取り戻す量
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

    console.log('\n✅ Clawbackが完了しました');

    console.log('\n📊 Clawback情報:');
    console.log(`  - MPTokenIssuanceID: ${mptIssuanceID}`);
    console.log(`  - 取り戻し量: ${tx.Amount.value}`);

    // Clawback後の残高を確認
    console.log('\n💰 Clawback後の保有者残高:');
    try {
      const holderBalanceAfter = await client.request({
        command: 'account_objects',
        account: user.address,
        ledger_index: 'validated',
      });
      if ('account_objects' in holderBalanceAfter.result) {
        const mptBalances = holderBalanceAfter.result.account_objects.filter(
          (obj) => {
            const ledgerObj = obj as {
              LedgerEntryType: string;
              MPTokenIssuanceID?: string;
            };
            return (
              ledgerObj.LedgerEntryType === 'MPToken' &&
              ledgerObj.MPTokenIssuanceID === mptIssuanceID
            );
          },
        );
        if (mptBalances.length > 0) {
          const mptBalance = mptBalances[0] as unknown as {
            MPTokenIssuanceID: string;
            MPTAmount: string;
          };
          console.log(`  - MPTokenIssuanceID: ${mptBalance.MPTokenIssuanceID}`);
          console.log(`    残高: ${mptBalance.MPTAmount}`);
        } else {
          console.log('  - 該当するMPToken残高がありません');
        }
      }
    } catch (balanceError) {
      console.log('⚠️  残高取得に失敗しました:', balanceError);
    }

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // Clawback特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: Clawback権限がありません（発行者のみが実行可能、かつtfMPTCanClawbackフラグが必要です）',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたMPTokenIssuanceIDが存在しません');
      } else if (error.message.includes('tecINSUFFICIENT_FUNDS')) {
        console.error('💡 ヒント: 保有者の残高が不足しています');
      } else if (error.message.includes('temMALFORMED')) {
        console.error('💡 ヒント: トランザクションが正しく指定されていません');
      } else if (error.message.includes('temDISABLED')) {
        console.error('💡 ヒント: Clawback Amendmentが有効ではありません');
      } else if (error.message.includes('tecINSUFFICIENT_RESERVE')) {
        console.error(
          '💡 ヒント: トランザクション実行後にアカウントの準備金要件を満たせません',
        );
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
  mptokenClawback().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
