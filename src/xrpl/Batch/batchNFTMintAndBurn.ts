import {
  type Batch,
  Client,
  convertStringToHex,
  hashes,
  type NFTokenBurn,
  type NFTokenMint,
  NFTokenMintFlags,
  Wallet,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { getBatchTxStatus } from '../../lib/getBatchTxStatus';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

/**
 * Batch トランザクション: NFTのミントと焼却
 *
 * このサンプルでは、以下の2段階のBatchトランザクションを実行します：
 * 1. 8つのNFTを一括ミント（Batch 1）
 * 2. ミントしたNFTを一括焼却（Batch 2）
 *
 * 両方のBatchトランザクションで Independent モードを使用し、
 * 一部が失敗しても他のトランザクションは継続されます。
 *
 * 📝 内部トランザクションの結果確認方法:
 * 1. Batchトランザクションを送信
 * 2. レジャーからBatchトランザクションの tx_json.RawTransactions を取得
 * 3. 各RawTransactionからハッシュを計算
 * 4. 計算したハッシュで各内部トランザクションの結果を個別に確認
 *
 * ユースケース例:
 * - 複数のNFTの焼却を一度のトランザクションで行う
 */
export async function batchNFTMintAndBurn(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🔄 Batch トランザクション (NFTミント → 焼却) を実行します...');
    console.log(`発行者アドレス: ${issuer.address}`);

    // ========================================
    // Step 1: 8つのNFTを一括ミント
    // ========================================
    console.log('\n📦 Step 1: 8つのNFTを一括ミント');

    const uri =
      'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
    const uriHex = convertStringToHex(uri);

    // ミント用の内部トランザクションを作成
    const mintTransactions: NFTokenMint[] = Array.from({ length: 8 }, () => ({
      TransactionType: 'NFTokenMint',
      Account: issuer.address,
      URI: uriHex,
      Flags:
        NFTokenMintFlags.tfBurnable |
        NFTokenMintFlags.tfTransferable |
        0x40000000, // NFTフラグ + tfInnerBatchTxn
      TransferFee: 0,
      NFTokenTaxon: 0,
      SigningPubKey: '',
      Fee: '0',
    }));

    console.log(
      `  準備完了: ${mintTransactions.length}つのNFTokenMintトランザクション`,
    );

    // Batch トランザクション1の準備（ミント）
    const mintBatchTx: Batch = {
      TransactionType: 'Batch',
      Account: issuer.address,
      Flags: 0x00080000, // tfIndependent
      RawTransactions: mintTransactions.map((tx) => ({ RawTransaction: tx })),
    };

    // トランザクションの自動入力
    const preparedMint = await client.autofill(mintBatchTx);

    // 署名
    const signedMint = issuer.sign(preparedMint);

    // 送信
    console.log('\n⏳ ミントBatchトランザクションを送信中...');
    const mintResult = await client.submitAndWait(signedMint.tx_blob);

    // 結果確認
    validateTransactionResult(mintResult);
    console.log('✅ ミントBatchトランザクション完了（tesSUCCESS）');
    logExplorerUrl(mintResult.result.hash);

    // ========================================
    // Step 2: ミントしたNFTokenIDを取得
    // ========================================
    console.log('\n📊 Step 2: ミントされたNFTのIDを取得中...');

    // アカウントのNFTページから直接取得
    const accountNFTs = await client.request({
      command: 'account_nfts',
      account: issuer.address,
    });

    const nftokenIDs: string[] = [];

    if (
      accountNFTs.result.account_nfts &&
      Array.isArray(accountNFTs.result.account_nfts)
    ) {
      // 最新の8つのNFTを取得（今回ミントしたもの）
      const allNFTs = accountNFTs.result.account_nfts;
      const latestNFTs = allNFTs.slice(-8); // 配列の最後の8つを取得

      for (const nft of latestNFTs) {
        if (nft.NFTokenID) {
          nftokenIDs.push(nft.NFTokenID);
        }
      }
    }

    if (nftokenIDs.length === 0) {
      console.error('❌ NFTokenIDの取得に失敗しました');
      console.error(
        '💡 アカウントにNFTが存在しないか、account_nftsコマンドが失敗しました',
      );
      return false;
    }

    console.log(`✅ ${nftokenIDs.length}個のNFTokenIDを取得しました`);
    nftokenIDs.forEach((id, index) => {
      console.log(`  NFT${index + 1}: ${id.substring(0, 16)}...`);
    });

    // ========================================
    // Step 3: 取得したNFTを一括焼却
    // ========================================
    console.log('\n📦 Step 3: 取得したNFTを一括焼却');

    // 焼却用の内部トランザクションを作成
    const burnTransactions: NFTokenBurn[] = nftokenIDs.map((nftokenID) => ({
      TransactionType: 'NFTokenBurn',
      Account: issuer.address,
      NFTokenID: nftokenID,
      Flags: 0x40000000, // tfInnerBatchTxn
      SigningPubKey: '',
      Fee: '0',
    }));

    console.log(
      `  準備完了: ${burnTransactions.length}つのNFTokenBurnトランザクション`,
    );

    // Batch トランザクション2の準備（焼却）
    const burnBatchTx: Batch = {
      TransactionType: 'Batch',
      Account: issuer.address,
      Flags: 0x00080000, // tfIndependent
      RawTransactions: burnTransactions.map((tx) => ({ RawTransaction: tx })),
    };

    // トランザクションの自動入力
    const preparedBurn = await client.autofill(burnBatchTx);

    // 署名
    const signedBurn = issuer.sign(preparedBurn);

    // 送信
    console.log('\n⏳ 焼却Batchトランザクションを送信中...');
    const burnResult = await client.submitAndWait(signedBurn.tx_blob);

    // 結果確認
    validateTransactionResult(burnResult);
    console.log('✅ 焼却Batchトランザクション完了（tesSUCCESS）');
    logExplorerUrl(burnResult.result.hash);

    // ========================================
    // Step 4: 焼却トランザクションの詳細確認
    // ========================================
    console.log('\n📊 Step 4: 焼却トランザクションの実行結果を確認中...');

    // レジャーからBatchトランザクションの詳細を取得
    const batchTxData = await client.request({
      command: 'tx',
      transaction: burnResult.result.hash,
    });

    // tx_json.RawTransactions から内部トランザクションを取得
    const txJson = batchTxData.result.tx_json;
    const rawTransactions = txJson?.RawTransactions;

    if (!rawTransactions || !Array.isArray(rawTransactions)) {
      console.log('⚠️  内部トランザクションが見つかりませんでした');
      return false;
    }

    // 各内部トランザクションのハッシュを計算
    const innerTxHashes: Array<{ hash: string; index: number }> = [];

    for (let i = 0; i < rawTransactions.length; i++) {
      const innerTx = rawTransactions[i].RawTransaction;
      if (innerTx) {
        try {
          const txHash = hashes.hashSignedTx(innerTx);
          innerTxHashes.push({ hash: txHash, index: i + 1 });
        } catch (error) {
          console.error(
            `  ⚠️  トランザクション${i + 1}のハッシュ計算に失敗:`,
            error,
          );
        }
      }
    }

    if (innerTxHashes.length === 0) {
      console.log('⚠️  内部トランザクションのハッシュが計算できませんでした');
      return false;
    }

    // 各内部トランザクションの結果を個別に取得
    const innerTxStatuses = await getBatchTxStatus(client, innerTxHashes);

    // 結果の表示
    console.log('\n📝 焼却トランザクションの実行結果:');
    innerTxStatuses.forEach((tx) => {
      const statusIcon = tx.successful ? '✅' : '❌';
      console.log(
        `  ${statusIcon} トランザクション${tx.index} (NFTokenBurn): ${tx.status}`,
      );
    });

    // 成功・失敗の統計
    const successCount = innerTxStatuses.filter((tx) => tx.successful).length;
    const failedCount = innerTxStatuses.filter((tx) => !tx.successful).length;

    console.log('\n📊 最終統計:');
    console.log(`  ミント成功: ${nftokenIDs.length}件`);
    console.log(`  焼却成功: ${successCount}件`);
    console.log(`  焼却失敗: ${failedCount}件`);

    if (failedCount > 0) {
      console.log('\n  ⚠️  一部のNFT焼却が失敗しました');
      console.log(
        '  💡 Independent モードのため、失敗したトランザクションがあっても成功したものは実行されました',
      );
    } else {
      console.log('\n  ✅ すべてのNFTが正常にミント・焼却されました');
      console.log('  💡 NFTのライフサイクル（ミント → 焼却）が完了しました');
    }

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // Batch特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temINVALID_INNER_BATCH')) {
        console.error('💡 ヒント: 内部トランザクションが不正です');
      } else if (error.message.includes('temSEQ_AND_TICKET')) {
        console.error(
          '💡 ヒント: TicketSequenceとSequenceの両方が指定されています',
        );
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: NFTを焼却する権限がありません（所有者ではない可能性があります）',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error('💡 ヒント: 指定されたNFTokenIDが存在しません');
      } else if (error.message.includes('temDISABLED')) {
        console.error(
          '💡 ヒント: Batch Amendmentが有効ではありません。Devnet/Testnetを使用していることを確認してください',
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
  batchNFTMintAndBurn().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
