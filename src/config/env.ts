import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['devnet', 'testnet', 'mainnet'], {
    message: 'NODE_ENVが不正です',
  }),
  IOU_CURRENCY: z.string().min(1, {
    message: 'IOU_CURRENCYが不正です',
  }),
  MPT_ISSUANCE_ID: z.string().min(1, {
    message: 'MPT_ISSUANCE_IDが不正です',
  }),
  ISUEER_SEED: z.string().min(1, {
    message: 'ISUEER_SEEDが不正です',
  }),
  USER_SEED: z.string().min(1, {
    message: 'USER_SEEDが不正です',
  }),
});

export const env = envSchema.parse(process.env);
