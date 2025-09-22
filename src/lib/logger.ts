import { getNetworkUrl } from '../config/network';

/**
 * エクスプローラーのURLを生成してログ出力する関数
 * @param transactionHash - トランザクションハッシュ
 * @param customMessage - カスタムメッセージ（オプション）
 */
export function logExplorerUrl(transactionHash: string): void {
  const network = getNetworkUrl();
  const explorerUrl = `${network.explorer}/transactions/${transactionHash}`;

  console.info(`🔍 エクスプローラー: ${explorerUrl}`);
}
