import type { TxResponse } from 'xrpl';

/**
 * トランザクション結果を検証し、tesSUCCESS以外の場合はエラーをスローする
 *
 * @param result - トランザクション結果
 * @throws {Error} トランザクションが失敗した場合
 */
export function validateTransactionResult(result: TxResponse): void {
  const txResult =
    typeof result.result.meta === 'object' &&
    'TransactionResult' in result.result.meta
      ? result.result.meta.TransactionResult
      : 'unknown';

  if (txResult !== 'tesSUCCESS') {
    throw new Error(`Transaction failed: ${txResult}`);
  }
}
