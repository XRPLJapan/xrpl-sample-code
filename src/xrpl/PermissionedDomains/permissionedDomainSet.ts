import {
  Client,
  convertStringToHex,
  type Node,
  type PermissionedDomainSet,
  type TransactionMetadataBase,
  Wallet,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function permissionedDomainSet(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);
    const user = Wallet.fromSeed(env.USER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    // PermissionedDomainSetトランザクションの準備
    // Tips: AcceptedCredentialsで指定するCredentialは、実際に台帳に存在しなくても設定可能です。
    // これにより、将来発行される予定のCredentialを事前に設定できます。
    const tx: PermissionedDomainSet = {
      TransactionType: 'PermissionedDomainSet',
      Account: user.address,
      // DomainID: '', // 既存のDomainIDを指定して更新も可能です
      AcceptedCredentials: [
        {
          Credential: {
            Issuer: issuer.address,
            CredentialType: convertStringToHex('VerifiedAccount3'), // HEX形式
          },
        },
      ],
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = user.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('✅ Permissioned Domain作成が完了しました');

    // 結果の表示
    console.log('\n📊 トランザクション結果:');
    console.log(result);

    // DomainIDを取得して表示
    const meta = result.result?.meta as TransactionMetadataBase | undefined;

    const domainNode = meta?.AffectedNodes?.find(
      (node: Node): node is Extract<Node, { CreatedNode: unknown }> =>
        'CreatedNode' in node &&
        node.CreatedNode.LedgerEntryType === 'PermissionedDomain',
    );
    console.log('🆔 Domain ID:', domainNode?.CreatedNode?.LedgerIndex);
    console.log(
      '💡 ヒント: このDomain IDをpermissionedDomainDelete.tsで使用してください',
    );

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // よくあるエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('tecDIR_FULL')) {
        console.error(
          '💡 ヒント: このアカウントはレジャーにこれ以上のオブジェクトを所有できません。',
        );
      } else if (error.message.includes('tecINSUFFICIENT_RESERVE')) {
        console.error(
          '💡 ヒント: アカウントに十分な準備金がありません。新しいPermissionedDomainを作成するには追加のXRPが必要です',
        );
      } else if (error.message.includes('tecNO_ENTRY')) {
        console.error(
          '💡 ヒント: 指定されたDomainIDが存在しません。DomainIDフィールドを確認してください',
        );
      } else if (error.message.includes('tecNO_ISSUER')) {
        console.error(
          '💡 ヒント: AcceptedCredentialsで指定された発行者の少なくとも1つがXRP Ledgerに存在しません',
        );
      } else if (error.message.includes('tecNO_PERMISSION')) {
        console.error(
          '💡 ヒント: 既存のDomainを変更しようとしましたが、送信者はそのDomainの所有者ではありません',
        );
      } else if (error.message.includes('temDISABLED')) {
        console.error(
          '💡 ヒント: PermissionedDomainsまたはCredentials amendmentが有効になっていません',
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
  permissionedDomainSet().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
