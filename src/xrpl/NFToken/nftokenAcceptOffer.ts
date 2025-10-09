import { Client, type NFTOffer, type NFTokenAcceptOffer, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function nftokenAcceptOffer(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const seller = Wallet.fromSeed(env.ISUEER_SEED); // 売却者
    const buyer = Wallet.fromSeed(env.USER_SEED); // 購入者

    // XRPLネットワークに接続
    await client.connect();

    console.log('🤝 NFTの売却オファーを受諾します...');
    console.log(`購入者アドレス: ${buyer.address}`);

    // 売却オファーIDを取得
    const accountObjects = await client.request({
      command: 'account_objects',
      account: seller.address,
      type: 'nft_offer',
    });

    interface NFTOfferObject extends NFTOffer {
      LedgerEntryType: string;
      index: string;
    }

    const nftOffers = accountObjects.result.account_objects.filter((obj) => {
      const offer = obj as NFTOfferObject;
      return offer.LedgerEntryType === 'NFTokenOffer';
    }) as NFTOfferObject[];

    if (nftOffers.length === 0) {
      console.error('❌ 売却オファーが見つかりません');
      return false;
    }

    const offerID = nftOffers[0]?.index;
    if (!offerID) {
      console.error('❌ 売却オファーIDの取得に失敗しました');
      return false;
    }

    // 売却オファーIDを指定する
    // const offerID = 'YOUR_NFT_SELL_OFFER_ID';

    // NFToken Accept Offerトランザクションの準備
    const tx: NFTokenAcceptOffer = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: buyer.address,
      NFTokenSellOffer: offerID, // 売却オファーID
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = buyer.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ オファー受諾が完了しました');
    console.log('🎉 NFTの所有権が移転されました');

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // NFTokenAcceptOffer特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temDISABLED')) {
        console.error(
          '💡 ヒント: NonFungibleTokensV1 Amendmentが有効ではありません',
        );
      } else if (error.message.includes('temMALFORMED')) {
        console.error(
          '💡 ヒント: トランザクションのフォーマットが正しくありません（オファーIDが指定されていない、またはBrokerFeeに負の値が指定されています）',
        );
      } else if (error.message.includes('tecCANT_ACCEPT_OWN_NFTOKEN_OFFER')) {
        console.error(
          '💡 ヒント: 購入者と販売者が同じアカウントです（自分のオファーは受諾できません）',
        );
      } else if (error.message.includes('tecEXPIRED')) {
        console.error(
          '💡 ヒント: 指定されたオファーの有効期限が既に切れています',
        );
      } else if (error.message.includes('tecINSUFFICIENT_PAYMENT')) {
        console.error(
          '💡 ヒント: ブローカーモードにおいて、購入額がBrokerFeeおよび売却コストを支払うには不十分です',
        );
      } else if (error.message.includes('tecINSUFFICIENT_FUNDS')) {
        console.error(
          '💡 ヒント: 購入者が申し出た金額を全額持っていません（準備金不足またはトークンがフリーズされている可能性があります）',
        );
      } else if (error.message.includes('tecOBJECT_NOT_FOUND')) {
        console.error('💡 ヒント: 指定されたオファーがレジャーに存在しません');
      } else if (error.message.includes('tecNFTOKEN_BUY_SELL_MISMATCH')) {
        console.error(
          '💡 ヒント: ブローカーモードにおいて、2つのオファーが有効なマッチングではありません',
        );
      } else if (error.message.includes('tecNFTOKEN_OFFER_TYPE_MISMATCH')) {
        console.error(
          '💡 ヒント: 指定されたオファーIDが実際のオファータイプと一致しません',
        );
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: 販売者がNFTokenを所有していない、またはDestinationの指定が異なります',
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
  nftokenAcceptOffer().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
