import { Client, type MPTokenIssuanceDestroy, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function mptokenIssuanceDestroy(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成（発行者）
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🗑️  MPTokenを破棄します...');
    console.log(`発行者アドレス: ${issuer.address}`);

    // 環境変数からMPTokenIssuanceIDを取得
    const mptIssuanceID = env.MPT_ISSUANCE_ID || '';

    if (!mptIssuanceID) {
      console.error('\n❌ MPTokenIssuanceIDが設定されていません');
      console.error(
        '💡 ヒント: mptokenIssuanceCreate.ts を実行して取得したMPTokenIssuanceIDを設定してください',
      );
      return false;
    }

    // MPTokenIssuanceの状態を確認
    console.log('\n📊 破棄前のMPTokenIssuance情報を確認...');
    try {
      const issuanceInfo = await client.request({
        command: 'ledger_entry',
        mpt_issuance: mptIssuanceID,
        ledger_index: 'validated',
      });
      console.log(JSON.stringify(issuanceInfo.result, null, 2));

      // 保有者が存在するかチェック
      const resultNode = issuanceInfo.result;
      if (resultNode.node && 'OutstandingAmount' in resultNode.node) {
        const outstandingAmount = resultNode.node.OutstandingAmount;
        if (outstandingAmount && outstandingAmount !== '0') {
          console.warn(
            '\n⚠️  警告: まだ保有者が存在します。破棄するには全ての保有者が保有していない状態にする必要があります',
          );
          console.warn(`   Outstanding Amount: ${outstandingAmount}`);
        }
      }
    } catch (entryError) {
      console.log('⚠️  MPTokenIssuance情報取得に失敗しました:', entryError);
    }

    // MPTokenIssuanceDestroy トランザクションの準備
    const tx: MPTokenIssuanceDestroy = {
      TransactionType: 'MPTokenIssuanceDestroy',
      Account: issuer.address, // 発行者アドレス
      MPTokenIssuanceID: mptIssuanceID, // 破棄するMPTokenIssuanceID
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = issuer.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ MPToken破棄が完了しました');

    console.log('\n📊 破棄情報:');
    console.log(`  - MPTokenIssuanceID: ${mptIssuanceID}`);
    console.log(`  - 発行者: ${issuer.address}`);

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // MPTokenIssuanceDestroy特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecHAS_OBLIGATIONS')) {
        console.error(
          '💡 ヒント: まだ保有者が存在します。破棄するには全ての保有者が保有していない状態にする必要があります',
        );
        console.error('   - 全ての保有者からトークンをClawbackする');
        console.error('   - または保有者にトークンを返還してもらう');
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: 破棄権限がありません（発行者のみが破棄できます）',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたMPTokenIssuanceIDが存在しません');
      } else if (error.message.includes('temMALFORMED')) {
        console.error('💡 ヒント: トランザクションが正しく指定されていません');
      } else if (error.message.includes('temDISABLED')) {
        console.error('💡 ヒント: MPTokensV1 Amendmentが有効ではありません');
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
  mptokenIssuanceDestroy().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
