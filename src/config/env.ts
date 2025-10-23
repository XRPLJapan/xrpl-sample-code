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
  MPT_ISSUANCE_ID: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  DOMAIN_ID: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  ISUEER_SEED: z.string().min(1, {
    message: 'ISUEER_SEEDが不正です',
  }),
  USER_SEED: z.string().min(1, {
    message: 'USER_SEEDが不正です',
  }),
  OUTSIDER_SEED: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
});

export const env = envSchema.parse(process.env);
