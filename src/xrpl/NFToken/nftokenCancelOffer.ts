import { Client, dropsToXrp, type NFTokenCancelOffer, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function nftokenCancelOffer(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成（オファー作成者）
    const creator = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('❌ NFTオファーをキャンセルします...');
    console.log(`アカウント: ${creator.address}`);

    // アカウントのオファーを取得
    const accountObjects = await client.request({
      command: 'account_objects',
      account: creator.address,
      type: 'nft_offer',
    });

    if (
      !accountObjects.result.account_objects ||
      accountObjects.result.account_objects.length === 0
    ) {
      console.error('❌ キャンセル可能なオファーが見つかりません');
      return false;
    }

    // NFTokenOfferのみをフィルタリング
    interface NFTOfferObject {
      LedgerEntryType: string;
      index: string;
      NFTokenID: string;
      Amount: string;
      Flags: number;
    }

    const nftOffers = accountObjects.result.account_objects.filter(
      (obj) => (obj as NFTOfferObject).LedgerEntryType === 'NFTokenOffer',
    );

    if (nftOffers.length === 0) {
      console.error('❌ NFTオファーが見つかりません');
      return false;
    }

    // 最初のオファーをキャンセル対象として選択
    const offer = nftOffers[0] as NFTOfferObject;
    if (!offer?.index) {
      console.error('❌ オファーの取得に失敗しました');
      return false;
    }

    const offerID = offer.index;

    console.log(`\n🎟️  キャンセル対象のオファーID: ${offerID}`);
    console.log(`🎫 NFTokenID: ${offer.NFTokenID}`);
    console.log(`💰 価格: ${dropsToXrp(offer.Amount)} XRP`);
    console.log(
      `📌 タイプ: ${offer.Flags === 1 ? '売却オファー' : '購入オファー'}`,
    );

    // NFToken Cancel Offerトランザクションの準備
    const tx: NFTokenCancelOffer = {
      TransactionType: 'NFTokenCancelOffer',
      Account: creator.address,
      NFTokenOffers: [offerID], // キャンセルするオファーIDの配列
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = creator.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ オファーのキャンセルが完了しました');

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // NFTokenCancelOffer特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temDISABLED')) {
        console.error(
          '💡 ヒント: NonFungibleTokensV1 Amendmentが有効ではありません',
        );
      } else if (error.message.includes('temMALFORMED')) {
        console.error(
          '💡 ヒント: トランザクションが正しく指定されていません（NFTokenOffersフィールドが空、または多すぎます）',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error(
          '💡 ヒント: 指定されたオファーが見つかりません、または既にキャンセル/受諾されています',
        );
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: このオファーをキャンセルする権限がありません（オファー作成者のみキャンセル可能）',
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
  nftokenCancelOffer().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
