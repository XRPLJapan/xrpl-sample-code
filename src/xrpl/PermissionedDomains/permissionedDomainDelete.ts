import { Client, type PermissionedDomainDelete, Wallet } from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function permissionedDomainDelete(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // DomainIDを指定（実際には事前に作成したDomainのIDを使用）
    // 注意: このスクリプトを実行する前に、permissionedDomainSet.tsを実行してDomainIDを取得してください
    const domainId = ''; // 例: 10A3C32C088698C9A42475CB1869940735F4FFAB0753C5065E4270A2328F672A

    if (!domainId) {
      console.error('❌ DomainIDが設定されていません');
      return false;
    }

    // PermissionedDomainDeleteトランザクションの準備
    const tx: PermissionedDomainDelete = {
      TransactionType: 'PermissionedDomainDelete',
      Account: user.address,
      DomainID: domainId,
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = user.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('✅ Permissioned Domain削除が完了しました');

    // 結果の表示
    console.log(result);

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // よくあるエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecNO_ENTRY')) {
        console.error(
          '💡 ヒント: DomainIDフィールドで指定されたPermissioned Domainがレジャー上に存在しません',
        );
      } else if (error.message.includes('temDISABLED')) {
        console.error(
          '💡 ヒント: PermissionedDomains amendmentが有効になっていません',
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
  permissionedDomainDelete().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
