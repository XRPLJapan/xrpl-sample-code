import {
  Client,
  convertStringToHex,
  type NFTokenMint,
  NFTokenMintFlags,
  Wallet,
  xrpToDrops,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function nftokenMintOffer(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED); // 発行者
    const buyer = Wallet.fromSeed(env.USER_SEED); // 購入者

    // XRPLネットワークに接続
    await client.connect();

    console.log('🎨 NFTを発行し、同時に売却オファーを作成します...');
    console.log(`発行者アドレス: ${issuer.address}`);

    // NFTのメタデータURI（例：IPFSやHTTPリンク）
    const uri =
      'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
    const uriHex = convertStringToHex(uri);

    // NFTokenMintと同時にOfferを作成する
    const tx: NFTokenMint = {
      TransactionType: 'NFTokenMint',
      Account: issuer.address, // 発行者アドレス
      URI: uriHex, // NFTのメタデータURI（例：IPFSやHTTPリンク）
      Flags: NFTokenMintFlags.tfBurnable | NFTokenMintFlags.tfTransferable, // フラグの組み合わせ（焼却可能 + 転送可能）
      TransferFee: 10000, // 10% (10000 / 100000 = 0.1)
      NFTokenTaxon: 0, // 分類用の任意の番号
      Amount: xrpToDrops('1'), // 売却価格: 1 XRP
      Destination: buyer.address, // オプション: 特定の購入者を指定
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = issuer.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ NFT発行と売却オファー作成が完了しました');

    // NFTokenIDを取得
    if (
      result.result.meta &&
      typeof result.result.meta === 'object' &&
      'nftoken_id' in result.result.meta
    ) {
      console.log(`\n🎫 NFTokenID: ${result.result.meta.nftoken_id}`);
    } else if (result.result.meta && typeof result.result.meta === 'object') {
      // メタデータからNFTokenページを探す
      if (
        'AffectedNodes' in result.result.meta &&
        Array.isArray(result.result.meta.AffectedNodes)
      ) {
        for (const node of result.result.meta.AffectedNodes) {
          if (
            'CreatedNode' in node &&
            node.CreatedNode.LedgerEntryType === 'NFTokenPage'
          ) {
            const newFields = node.CreatedNode.NewFields;
            if (
              newFields &&
              'NFTokens' in newFields &&
              Array.isArray(newFields['NFTokens']) &&
              newFields['NFTokens'].length > 0
            ) {
              console.log(
                `\n🎫 NFTokenID: ${newFields['NFTokens'][0].NFToken.NFTokenID}`,
              );
            }
          } else if (
            'ModifiedNode' in node &&
            node.ModifiedNode.LedgerEntryType === 'NFTokenPage'
          ) {
            const finalFields = node.ModifiedNode.FinalFields;
            if (
              finalFields &&
              'NFTokens' in finalFields &&
              Array.isArray(finalFields['NFTokens'])
            ) {
              // 最後に追加されたNFTを表示
              const nftokens = finalFields['NFTokens'];
              if (nftokens.length > 0) {
                console.log(
                  `\n🎫 NFTokenID: ${nftokens[nftokens.length - 1].NFToken.NFTokenID}`,
                );
              }
            }
          }
        }
      }
    }

    // オファーIDを取得
    if (
      result.result.meta &&
      typeof result.result.meta === 'object' &&
      'offer_id' in result.result.meta
    ) {
      console.log(`🎟️  売却オファーID: ${result.result.meta.offer_id}`);
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
            console.log(`🎟️  売却オファーID: ${node.CreatedNode.LedgerIndex}`);
          }
        }
      }
    }

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // NFTokenMint特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temBAD_NFTOKEN_TRANSFER_FEE')) {
        console.error(
          '💡 ヒント: TransferFeeが許容範囲外です（0-50000の範囲で指定してください）',
        );
      } else if (error.message.includes('temINVALID_FLAG')) {
        console.error(
          '💡 ヒント: 無効なフラグが指定されています（tfTrustLineフラグは非推奨です）',
        );
      } else if (error.message.includes('temMALFORMED')) {
        console.error(
          '💡 ヒント: トランザクションが正しく指定されていません（URIは256バイト以下にしてください）',
        );
      } else if (error.message.includes('tecNO_ISSUER')) {
        console.error('💡 ヒント: Issuerで指定されたアカウントが存在しません');
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: 発行者の代理としてNFTを発行する権限がありません',
        );
      } else if (error.message.includes('tecINSUFFICIENT_RESERVE')) {
        console.error(
          '💡 ヒント: トークン発行後にアカウントの準備金要件を満たせません',
        );
      } else if (error.message.includes('tecMAX_SEQUENCE_REACHED')) {
        console.error(
          '💡 ヒント: 発行者のMintedNFTokensフィールドが最大値に達しています',
        );
      } else if (error.message.includes('tecDIR_FULL')) {
        console.error(
          '💡 ヒント: NFTokenページが満杯です。別のトランザクションで再試行してください',
        );
      } else if (error.message.includes('tecNO_DST')) {
        console.error(
          '💡 ヒント: Destinationで指定されたアカウントが存在しません',
        );
      } else if (error.message.includes('temBAD_AMOUNT')) {
        console.error(
          '💡 ヒント: Amountフィールドが無効です（金額がゼロ、または負の値が指定されています）',
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
  nftokenMintOffer().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
