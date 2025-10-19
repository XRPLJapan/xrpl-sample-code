import {
  Client,
  convertStringToHex,
  type MPTokenIssuanceCreate,
  MPTokenIssuanceCreateFlags,
  Wallet,
} from 'xrpl';
import { env } from '../../config/env';
import { getNetworkUrl } from '../../config/network';
import { logExplorerUrl } from '../../lib/logger';
import { validateTransactionResult } from '../../lib/validateTransaction';

export async function mptokenIssuanceCreate(): Promise<boolean> {
  // ネットワーク設定
  const network = getNetworkUrl();
  const client = new Client(network.ws);

  try {
    // ウォレット作成（発行者）
    const issuer = Wallet.fromSeed(env.ISUEER_SEED);

    // XRPLネットワークに接続
    await client.connect();

    console.log('🪙 MPTokenを発行します...');
    console.log(`発行者アドレス: ${issuer.address}`);

    // MPTのメタデータ（XLS-89d標準に準拠 - 国債を想定）
    const metadata = JSON.stringify({
      ticker: 'JGB10Y', // 必須: ティッカーシンボル（10年国債）
      name: 'Japan Government Bond Token', // 必須: トークンの表示名
      desc: 'A yield-bearing token backed by 10-year Japanese Government Bonds with fixed interest payments.', // オプション: 短い説明
      icon: 'https://example.org/jgb-icon.png', // 必須: アイコンのURL（HTTPS）
      asset_class: 'rwa', // 必須: 資産クラス（Real World Assets）
      asset_subclass: 'treasury', // asset_class='rwa'の場合は必須
      issuer_name: 'Japan Treasury Co.', // 必須: 発行者名
      urls: [
        // オプション: 関連URLのリスト
        {
          url: 'https://japan-treasury.co/jgb10y',
          type: 'website',
          title: 'Product Page',
        },
        {
          url: 'https://example-jgb10y.com/docs',
          type: 'docs',
          title: 'Bond Token Documentation',
        },
      ],
      additional_info: {
        // オプション: 追加情報（金利、満期日など）
        interest_rate: '0.50%',
        interest_type: 'fixed',
        yield_source: 'Japanese Government Bonds',
        maturity_date: '2034-03-20',
        bond_code: 'JGB10Y-2034',
        face_value: '1000000', // 額面100万円
        payment_frequency: 'semi-annual',
      },
    });
    const metadataHex = convertStringToHex(metadata);

    // MPTokenIssuanceCreate トランザクションの準備
    const tx: MPTokenIssuanceCreate = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: issuer.address, // 発行者アドレス
      AssetScale: 0, // 小数点以下2桁 0=整数 1=小数点以下1桁 2=小数点以下2桁
      MaximumAmount: '1000000000', // 最大供給量（オプション）
      // TransferFee: 1000, // 転送手数料 1% (1000 / 100000 = 0.01)
      MPTokenMetadata: metadataHex, // メタデータ（オプション）
      Flags:
        // | MPTokenIssuanceCreateFlags.tfMPTCanLock // ロック機能を有効にする
        MPTokenIssuanceCreateFlags.tfMPTRequireAuth | // 認可必須（有効にした場合、mptokenAuthorizeByIssuer.ts で発行者による認可が必要）
        // | MPTokenIssuanceCreateFlags.tfMPTCanEscrow // Escrow機能を有効にする
        // | MPTokenIssuanceCreateFlags.tfMPTCanTrade // DEXでの取引機能を有効にする
        // | MPTokenIssuanceCreateFlags.tfMPTCanTransfer // 第三者間の転送機能を有効にする
        MPTokenIssuanceCreateFlags.tfMPTCanClawback, // Clawback機能を有効にする
    };

    // トランザクションの自動入力（手数料、シーケンス番号など）
    const prepared = await client.autofill(tx);

    // トランザクションに署名
    const signed = issuer.sign(prepared);

    // トランザクションを送信して結果を待機
    const result = await client.submitAndWait(signed.tx_blob);

    // トランザクション結果を確認（tesSUCCESS以外はエラーをスロー）
    validateTransactionResult(result);

    console.log('\n✅ MPToken発行が完了しました');

    // MPTokenIssuanceIDを取得
    if (
      result.result.meta &&
      typeof result.result.meta === 'object' &&
      'mpt_issuance_id' in result.result.meta
    ) {
      console.log(
        `\n🪙 MPTokenIssuanceID: ${result.result.meta.mpt_issuance_id}`,
      );
    } else if (result.result.meta && typeof result.result.meta === 'object') {
      // メタデータからMPTokenIssuanceを探す
      if (
        'AffectedNodes' in result.result.meta &&
        Array.isArray(result.result.meta.AffectedNodes)
      ) {
        for (const node of result.result.meta.AffectedNodes) {
          if (
            'CreatedNode' in node &&
            node.CreatedNode.LedgerEntryType === 'MPTokenIssuance'
          ) {
            const newFields = node.CreatedNode.NewFields;
            if (newFields && 'MPTokenIssuanceID' in newFields) {
              console.log(
                `\n🪙 MPTokenIssuanceID: ${newFields['MPTokenIssuanceID']}`,
              );
            }
          }
        }
      }
    }

    // 環境変数にMPTokenIssuanceIDを設定するためのヒントを表示
    console.log(
      '💡 ヒント: 環境変数のMPT_ISSUANCE_IDにMPTokenIssuanceIDを設定してください',
    );

    // エクスプローラーで確認できるURLを表示
    logExplorerUrl(result.result.hash);

    return true;
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);

    // MPTokenIssuanceCreate特有のエラーメッセージの説明
    if (error instanceof Error) {
      if (error.message.includes('temMALFORMED')) {
        console.error('💡 ヒント: トランザクションが正しく指定されていません');
      } else if (
        error.message.includes(
          'TransferFee cannot be provided without enabling tfMPTCanTransfer',
        )
      ) {
        console.error(
          '💡 ヒント: TransferFeeを設定するには、tfMPTCanTransferフラグを有効にする必要があります',
        );
      } else if (error.message.includes('temBAD_MPTOKEN_TRANSFER_FEE')) {
        console.error(
          '💡 ヒント: TransferFeeが許容範囲外です（0-50000の範囲で指定してください）',
        );
      } else if (error.message.includes('temBAD_MPTOKEN_ASSET_SCALE')) {
        console.error(
          '💡 ヒント: AssetScaleが許容範囲外です（0-19の範囲で指定してください）',
        );
      } else if (error.message.includes('tecINSUFFICIENT_RESERVE')) {
        console.error(
          '💡 ヒント: トークン発行後にアカウントの準備金要件を満たせません',
        );
      } else if (error.message.includes('tecDUPLICATE')) {
        console.error('💡 ヒント: 同じ設定のMPTokenIssuanceが既に存在します');
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
  mptokenIssuanceCreate().then((success) => {
    if (!success) {
      process.exit(1);
    }
  });
}
