import {
  Client,
  convertStringToHex,
  type NFTokenMint,
  NFTokenMintFlags,
  type NFTokenModify,
  Wallet,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

/**
 * ダイナミックNFT（dNFT）のサンプル
 *
 * 1. tfMutableフラグを使用してNFTをMint
 * 2. NFTokenModifyトランザクションでURIを更新
 */

// カスタムフラグ: tfMutable (0x00000010 = 16)
const tfMutable = 0x00000010;

export async function nftokenDynamic(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成（発行者）
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🎨 ステップ1: ダイナミックNFT（dNFT）を発行します...');
    console.log(`発行者アドレス: ${issuer.address}`);

    // 初期のメタデータURI
    const initialUri = 'ipfs://QmInitialMetadata/v1.json';
    const initialUriHex = convertStringToHex(initialUri);

    // NFToken Mintトランザクションの準備（tfMutableフラグ付き）
    const mintTx: NFTokenMint = {
      TransactionType: 'NFTokenMint',
      Account: issuer.address,
      URI: initialUriHex,
      // tfMutable + tfBurnable + tfTransferable
      Flags:
        tfMutable |
        NFTokenMintFlags.tfBurnable |
        NFTokenMintFlags.tfTransferable,
      TransferFee: 5000, // 5%
      NFTokenTaxon: 0,
    };

    console.log('\n📝 Mintトランザクション内容:');
    console.log(`  - URI: ${initialUri}`);
    console.log(`  - Flags: tfMutable + Burnable + Transferable`);
    console.log(`  - TransferFee: 5%`);

    // トランザクションの自動入力
    const preparedMint = await client.autofill(mintTx);

    // トランザクションに署名
    const signedMint = issuer.sign(preparedMint);

    // トランザクションを送信して結果を待機
    const mintResult = await client.submitAndWait(signedMint.tx_blob);

    // トランザクション結果を確認
    validateTransactionResult(mintResult);

    console.log('\n✅ dNFT発行が完了しました');

    // NFTokenIDを取得
    const nftokenID =
      mintResult.result.meta &&
      typeof mintResult.result.meta === 'object' &&
      'nftoken_id' in mintResult.result.meta
        ? (mintResult.result.meta.nftoken_id as string)
        : '';

    if (!nftokenID) {
      console.error('❌ NFTokenIDの取得に失敗しました');
      return false;
    }

    console.log(`🎫 NFTokenID: ${nftokenID}`);
    logExplorerUrl(mintResult.result.hash);

    // ステップ2: NFTokenModifyでURIを更新
    console.log('\n🔄 ステップ2: NFTのURIを更新します...');

    // 少し待機（レジャーの確定を待つ）
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 更新後のメタデータURI
    const updatedUri = 'ipfs://QmUpdatedMetadata/v2.json';
    const updatedUriHex = convertStringToHex(updatedUri);

    // NFTokenModifyトランザクションの準備
    const modifyTx: NFTokenModify = {
      TransactionType: 'NFTokenModify',
      Account: issuer.address,
      NFTokenID: nftokenID,
      URI: updatedUriHex,
    };

    console.log('\n📝 Modifyトランザクション内容:');
    console.log(`  - NFTokenID: ${nftokenID}`);
    console.log(`  - 旧URI: ${initialUri}`);
    console.log(`  - 新URI: ${updatedUri}`);

    // トランザクションの自動入力
    const preparedModify = await client.autofill(modifyTx);

    // トランザクションに署名
    const signedModify = issuer.sign(preparedModify);

    // トランザクションを送信して結果を待機
    const modifyResult = await client.submitAndWait(signedModify.tx_blob);

    // トランザクション結果を確認
    validateTransactionResult(modifyResult);

    console.log('\n✅ URI更新が完了しました');
    console.log('🎉 ダイナミックNFTの作成と更新に成功しました！');

    logExplorerUrl(modifyResult.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    if (error instanceof Error) {
      // NFTokenMint関連のエラー
      if (error.message.includes('temBAD_NFTOKEN_TRANSFER_FEE')) {
        console.error(
          '💡 ヒント: TransferFeeが許容範囲外です（0-50000の範囲で指定してください）',
        );
      } else if (error.message.includes('temINVALID_FLAG')) {
        console.error('💡 ヒント: 無効なフラグが指定されています');
      } else if (error.message.includes('temMALFORMED')) {
        console.error('💡 ヒント: トランザクションが正しく指定されていません');
      } else if (error.message.includes('tecINSUFFICIENT_RESERVE')) {
        console.error(
          '💡 ヒント: トークン発行後にアカウントの準備金要件を満たせません',
        );
      }
      // NFTokenModify関連のエラー
      else if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたNFTokenが見つかりません');
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: このNFTを変更する権限がありません（発行者のみ変更可能）',
        );
      } else if (error.message.includes('tecNFTOKEN_IS_NOT_MUTABLE')) {
        console.error(
          '💡 ヒント: このNFTはミュータブルではありません（tfMutableフラグが必要）',
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
  nftokenDynamic().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
