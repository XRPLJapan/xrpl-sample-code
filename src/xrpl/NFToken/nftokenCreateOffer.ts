import {
  Client,
  type NFTokenCreateOffer,
  NFTokenCreateOfferFlags,
  Wallet,
  xrpToDrops,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function nftokenCreateOffer(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const seller = Wallet.fromSeed(env.ISUEER_SEED); // NFT所有者（売却者）
    // const buyer = Wallet.fromSeed(env.USER_SEED); // 購入者（オプション）

    // XRPLネットワークに接続
    await client.connect();

    console.log('💰 NFTの売却オファーを作成します...');
    console.log(`売却者アドレス: ${seller.address}`);

    // 所有しているNFTを取得
    const nfts = await client.request({
      command: 'account_nfts',
      account: seller.address,
    });

    if (!nfts.result.account_nfts || nfts.result.account_nfts.length === 0) {
      console.error('❌ 売却可能なNFTが見つかりません');
      console.log(
        '💡 先にNFTを発行してください: npx tsx src/xrpl/NFToken/nftokenMint.ts',
      );
      return false;
    }

    // 最初のNFTを売却対象として選択する場合（実際の開発では、売却対象のnftokenIDを指定する。）
    const nftokenID = nfts.result.account_nfts[0]?.NFTokenID;
    if (!nftokenID) {
      console.error('❌ NFTokenIDの取得に失敗しました');
      return false;
    }

    // 売却対象のnftokenIDを指定する場合
    // const nftokenID = 'YOUR_NFT_TOKEN_ID';

    console.log(`\n🎫 売却対象のNFTokenID: ${nftokenID}`);

    // NFToken Create Offerトランザクションの準備（売却オファー）
    const tx: NFTokenCreateOffer = {
      TransactionType: 'NFTokenCreateOffer',
      Account: seller.address,
      NFTokenID: nftokenID,
      Amount: xrpToDrops(1).toString(), // 売却価格: 1 XRP
      Flags: NFTokenCreateOfferFlags.tfSellNFToken, // 売却オファー
      // Destination: buyer.address, // オプション: 特定の購入者を指定
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = seller.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ 売却オファーが作成されました');

    // オファーIDを取得
    if (
      result.result.meta &&
      typeof result.result.meta === 'object' &&
      'offer_id' in result.result.meta
    ) {
      console.log(`\n🎟️  オファーID: ${result.result.meta.offer_id}`);
    } else if (result.result.meta && typeof result.result.meta === 'object') {
      // メタデータからオファーIDを探す
      if (
        'AffectedNodes' in result.result.meta &&
        Array.isArray(result.result.meta.AffectedNodes)
      ) {
        for (const node of result.result.meta.AffectedNodes) {
          if (
            'CreatedNode' in node &&
            node.CreatedNode.LedgerEntryType === 'NFTokenOffer'
          ) {
            console.log(`\n🎟️  オファーID: ${node.CreatedNode.LedgerIndex}`);
          }
        }
      }
    }

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // NFTokenCreateOffer特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temBAD_AMOUNT')) {
        console.error(
          '💡 ヒント: Amountフィールドが無効です（購入オファーで金額がゼロ、またはlsfOnlyXRPフラグが有効なのにトークンを指定）',
        );
      } else if (error.message.includes('temBAD_EXPIRATION')) {
        console.error(
          '💡 ヒント: 指定されたExpirationが無効です（0は指定できません）',
        );
      } else if (error.message.includes('temMALFORMED')) {
        console.error('💡 ヒント: トランザクションが正しく指定されていません');
      } else if (error.message.includes('tecDIR_FULL')) {
        console.error(
          '💡 ヒント: 送信者がすでに多くのオブジェクトを所有しているか、このトークンのオファーが多すぎます',
        );
      } else if (error.message.includes('tecEXPIRED')) {
        console.error(
          '💡 ヒント: 指定されたExpirationの時間は既に経過しています',
        );
      } else if (error.message.includes('tecFROZEN')) {
        console.error(
          '💡 ヒント: トークンのトラストラインがフリーズされています',
        );
      } else if (error.message.includes('tecINSUFFICIENT_RESERVE')) {
        console.error(
          '💡 ヒント: オファー作成後に所有者準備金を満たすのに十分なXRPがありません',
        );
      } else if (error.message.includes('tecNO_DST')) {
        console.error(
          '💡 ヒント: Destinationで指定されたアカウントが存在しません',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error(
          '💡 ヒント: 指定されたNFTokenをアカウントが所有していません',
        );
      } else if (error.message.includes('tecNO_ISSUER')) {
        console.error(
          '💡 ヒント: Amountフィールドで指定した発行者が存在しません',
        );
      } else if (error.message.includes('tecNO_LINE')) {
        console.error(
          '💡 ヒント: NFTokenの発行者がトークンのトラストラインを持っていません',
        );
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: Destinationアカウントが着信するNFTokenOfferをブロックしています',
        );
      } else if (error.message.includes('tecUNFUNDED_OFFER')) {
        console.error(
          '💡 ヒント: 購入オファーの金額を支払うための資金が不足しています',
        );
      } else if (error.message.includes('tefNFTOKEN_IS_NOT_TRANSFERABLE')) {
        console.error(
          '💡 ヒント: このNFTokenはlsfTransferableフラグが無効で、転送できません',
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
  nftokenCreateOffer().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
