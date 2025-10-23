import { Client, type Payment, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function sendIOUOutsider(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // OUTSIDER_SEEDの確認
    if (!env.OUTSIDER_SEED) {
      console.error(
        '❌ OUTSIDER_SEEDが設定されていません。.envファイルにOUTSIDER_SEEDを設定してください。',
      );
      console.error(
        '💡 ヒント: ドメインメンバーではないアカウントへIOUを送金するには、OUTSIDER_SEEDが必要です。',
      );
      return false;
    }

    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const outsider = Wallet.fromSeed(env.OUTSIDER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log(
      '👤 ドメインメンバーではないアカウント（Outsider）へIOUを送金します',
    );
    console.log(`発行者アドレス: ${issuer.address}`);
    console.log(`外部者アドレス: ${outsider.address}`);
    console.log(
      '\n💡 ドメインメンバーではないアカウントもIOUを保有することで、オープンDEXで取引できるようになります',
    );

    // IOU送金トランザクションの準備
    const tx: Payment = {
      TransactionType: 'Payment',
      Account: issuer.address,
      Destination: outsider.address,
      Amount: {
        currency: env.IOU_CURRENCY, // 通貨コード（3文字）
        issuer: issuer.address, // 発行者アドレス
        value: '100', // 送金額（文字列）
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

    console.log(
      '\n✅ ドメインメンバーではないアカウントへのIOU送金処理が完了しました',
    );

    // 結果の表示
    console.log('\n📊 トランザクション結果:');
    console.log(result);

    console.log(
      `\n💡 このアカウントは${env.IOU_CURRENCY}を保有し、オープンDEXでオファーを作成できます`,
    );
    console.log(
      '💡 ただし、Permissioned DEX内のパーミッションオファーとは取引できません',
    );

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // よくあるエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecNO_LINE')) {
        console.error(
          '💡 ヒント: このアカウントが該当IOUのTrustLineを保有していません。trustSetOutsider.tsを先に実行してください',
        );
      } else if (error.message.includes('tecNO_AUTH')) {
        console.error(
          '💡 ヒント: 発行者アカウントがRequireAuth設定で、承認が必要です',
        );
      } else if (error.message.includes('tecPATH_DRY')) {
        console.error('💡 ヒント: 送金経路が見つかりません');
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
  sendIOUOutsider().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
