import { Client, type TrustSet, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function trustSetOutsider(): Promise<boolean> {
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
        '💡 ヒント: ドメインメンバーではないアカウントでTrustLineを設定するには、OUTSIDER_SEEDが必要です。',
      );
      return false;
    }

    // ウォレット作成
    const outsider = Wallet.fromSeed(env.OUTSIDER_SEED);
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log(
      '👤 ドメインメンバーではないアカウント（Outsider）のTrustLineを設定します',
    );
    console.log(`外部者アドレス: ${outsider.address}`);
    console.log(`発行者アドレス: ${issuer.address}`);

    // TrustSetトランザクションの準備
    const tx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: outsider.address,
      LimitAmount: {
        currency: env.IOU_CURRENCY, // 通貨コード（3文字）
        issuer: issuer.address, // 発行者アドレス
        value: '1000000', // 信頼限度額（文字列）
      },
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = outsider.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log(
      '\n✅ ドメインメンバーではないアカウントのTrustLine設定が完了しました',
    );

    // 結果の表示
    console.log('\n📊 トランザクション結果:');
    console.log(result);

    console.log(
      `\n💡 このアカウントは${env.IOU_CURRENCY}通貨をオープンDEXで取引できるようになりました`,
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
      if (error.message.includes('tecUNFUNDED_PAYMENT')) {
        console.error('💡 ヒント: アカウントの準備金が不足しています');
      } else if (error.message.includes('temBAD_CURRENCY')) {
        console.error(
          '💡 ヒント: 通貨コードが無効です（3文字である必要があります）',
        );
      } else if (error.message.includes('temINVALID_FLAG')) {
        console.error('💡 ヒント: フラグの設定が無効です');
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
  trustSetOutsider().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
