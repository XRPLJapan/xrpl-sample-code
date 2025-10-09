import { Client, type NFTokenBurn, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function nftokenBurn(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成（NFT所有者）
    const owner = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔥 NFTを焼却します...');
    console.log(`所有者アドレス: ${owner.address}`);

    // 所有しているNFTを取得
    const nfts = await client.request({
      command: 'account_nfts',
      account: owner.address,
    });

    if (!nfts.result.account_nfts || nfts.result.account_nfts.length === 0) {
      console.error('❌ 焼却可能なNFTが見つかりません');
      return false;
    }

    // 最初のNFTを焼却対象として選択する場合（実際の開発では、焼却対象のnftokenIDを指定する。）
    const nftokenID = nfts.result.account_nfts[0]?.NFTokenID;
    if (!nftokenID) {
      console.error('❌ NFTokenIDの取得に失敗しました');
      return false;
    }

    // 焼却対象のnftokenIDを指定する場合
    // const nftokenID = 'YOUR_NFT_TOKEN_ID';

    console.log(`\n🎫 焼却対象のNFTokenID: ${nftokenID}`);

    // NFToken Burnトランザクションの準備
    const tx: NFTokenBurn = {
      TransactionType: 'NFTokenBurn',
      Account: owner.address,
      NFTokenID: nftokenID,
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = owner.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ NFT焼却が完了しました');

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // NFTokenBurn特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたTokenIDが見つかりませんでした');
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: このアカウントにはトークンをBurnする権限がありません',
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
  nftokenBurn().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
