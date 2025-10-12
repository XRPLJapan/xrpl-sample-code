import type { Client } from 'xrpl';

/**
 * Batch トランザクション内の各内部トランザクションの実行結果を取得
 *
 * @param client - XRPL クライアント
 * @param innerTxHashes - 内部トランザクションのハッシュ配列
 * @returns 各内部トランザクションの成功/失敗情報
 */
export interface InnerTxStatus {
  hash: string;
  successful: boolean;
  status: string;
  index: number;
}

export async function getBatchTxStatus(
  client: Client,
  innerTxHashes: Array<{ hash: string; index: number }>,
): Promise<InnerTxStatus[]> {
  const results = await Promise.all(
    innerTxHashes.map(async (tx) => {
      try {
        const res = await client.request({
          command: 'tx',
          transaction: tx.hash,
        });

        if (
          res.result.meta &&
          typeof res.result.meta === 'object' &&
          'TransactionResult' in res.result.meta
        ) {
          const meta = res.result.meta as { TransactionResult: string };
          const isSuccess = meta.TransactionResult === 'tesSUCCESS';

          return {
            hash: tx.hash,
            index: tx.index,
            successful: isSuccess,
            status: meta.TransactionResult,
          };
        }

        return {
          hash: tx.hash,
          index: tx.index,
          successful: false,
          status: 'unknown',
        };
      } catch (error) {
        return {
          hash: tx.hash,
          index: tx.index,
          successful: false,
          status: 'not validated',
        };
      }
    }),
  );

  return results;
}
