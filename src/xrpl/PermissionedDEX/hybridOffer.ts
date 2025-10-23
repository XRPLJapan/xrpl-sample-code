import {
  Client,
  type OfferCreate,
  OfferCreateFlags,
  Wallet,
  xrpToDrops,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function hybridOffer(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // DomainIDの確認
    if (!env.DOMAIN_ID) {
      console.error(
        '❌ DOMAIN_IDが設定されていません。.envファイルにDOMAIN_IDを設定してください。',
      );
      console.error(
        '💡 ヒント: permissionedDomainSet.tsを実行してDomain IDを取得してください。',
      );
      return false;
    }

    // ハイブリッドオファーの準備
    // Tips: ハイブリッドオファーは、指定されたドメインIDのDEXとオープンDEXの両方で取引できます。
    // 作成時は、まずパーミッションDEXのオファーと優先的にマッチングします。
    const tx: OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: user.address,
      TakerGets: {
        currency: env.IOU_CURRENCY,
        issuer: issuer.address,
        value: '1', // 1 IOU Currency
      },
      TakerPays: xrpToDrops('1'), // 1 XRP
      // ハイブリッドオファーの設定
      // DomainID + tfHybridフラグでハイブリッドオファーになります
      DomainID: env.DOMAIN_ID, // permissionedDomainSet.tsで取得したDomain IDを.envファイルに設定
      Flags: OfferCreateFlags.tfHybrid, // ハイブリッドフラグを設定
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = user.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('✅ ハイブリッドオファーの作成が完了しました');

    // 結果の表示
    console.log('\n📊 トランザクション結果:');
    console.log(result);

    console.log(
      '\n💡 このオファーは指定されたドメインIDのDEXとオープンDEXの両方で取引可能です',
    );
    console.log(
      '💡 作成時は、パーミッションDEXのオファーと優先的にマッチングします',
    );

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // よくあるエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecUNFUNDED_OFFER')) {
        console.error(
          '💡 ヒント: オファーを実行するための残高が不足しています',
        );
      } else if (error.message.includes('tecNO_LINE')) {
        console.error(
          '💡 ヒント: 通貨のトラストラインが存在しません。TrustSetトランザクションを先に実行してください',
        );
      } else if (error.message.includes('tecINSUFF_RESERVE_OFFER')) {
        console.error(
          '💡 ヒント: オファーを作成するための準備金が不足しています',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error(
          '💡 ヒント: 指定されたDomainIDが存在しないか、アカウントがそのドメインへのアクセス権を持っていません',
        );
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: このアカウントは指定されたドメインへのアクセス権を持っていません。適切なCredentialを取得してください',
        );
      } else if (error.message.includes('temDISABLED')) {
        console.error(
          '💡 ヒント: PermissionedDEX amendmentが有効になっていません',
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
  hybridOffer().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
