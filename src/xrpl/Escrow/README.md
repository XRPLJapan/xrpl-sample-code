# Escrow（エスクロー）

XRP Ledgerのエスクロー（預託機能）を使用して、XRPやトークンを条件付きでロックし、指定された条件が満たされた時に解放するサンプルコードです。

## 📋 概要

エスクローは、第三者を介さずにXRPやトークンを安全にロックし、特定の条件が満たされた時にのみ解放する機能です。XRP Ledgerでは、以下の3つのタイプのエスクローをサポートしています：

1. **Time-based Escrow（時間ベースエスクロー）**: 指定時間後に利用可能
2. **Conditional Escrow（条件付きエスクロー）**: 暗号条件を満たした時に利用可能
3. **Combination Escrow（組み合わせエスクロー）**: 時間と条件の両方を指定

### 対応アセット
- **XRP**: ネイティブ通貨
- **Trust Line Tokens（IOU）**: 発行者が発行する従来のトークン
- **Multi-Purpose Tokens（MPT）**: より柔軟な機能を持つ新しいトークンタイプ

## ⏰ FinishAfterとCancelAfterの詳細

エスクローのタイミング制御には、`FinishAfter`と`CancelAfter`の2つのフィールドが使用されます。

### FinishAfter（利用可能時間）

エスクローが**完了可能になる時間**を指定します。

- **形式**: Rippleエポック（2000-01-01 00:00 UTCからの秒数）
- **必須/オプション**: オプション（指定しない場合、即座に完了可能）
- **制約**: 現在時刻より未来の時間を指定する必要がある
- **効果**: この時間が経過するまで、`EscrowFinish`トランザクションは失敗する

```typescript
// 例: 現在時刻から60秒後
import { isoTimeToRippleTime } from 'xrpl';

const finishAfterDate = new Date(Date.now() + 60 * 1000); // 60秒後
const finishAfter = isoTimeToRippleTime(finishAfterDate.toISOString());
```

### CancelAfter（期限時間）

エスクローが**期限切れになる時間**を指定します。

- **形式**: Rippleエポック（2000-01-01 00:00 UTCからの秒数）
- **必須/オプション**: 
  - **XRPエスクロー**: オプション（指定しない場合、期限なし）
  - **トークンエスクロー**: **必須**
- **制約**: 
  - 現在時刻より未来の時間を指定する必要がある
  - `FinishAfter`を指定する場合、`CancelAfter`は`FinishAfter`より後の時間を指定する必要がある
- **効果**: この時間が経過した後、`EscrowCancel`トランザクションで資金を送信者に返却できる

```typescript
// 例: 現在時刻から300秒後（5分後）
import { isoTimeToRippleTime } from 'xrpl';

const cancelAfterDate = new Date(Date.now() + 300 * 1000); // 300秒後
const cancelAfter = isoTimeToRippleTime(cancelAfterDate.toISOString());
```

### XRPエスクローとトークンエスクローの違い

| 項目 | XRPエスクロー | トークンエスクロー |
|------|--------------|-------------------|
| `FinishAfter` | オプション | オプション |
| `CancelAfter` | **オプション** | **必須** |
| `CancelAfter`なしの場合 | 永続的エスクロー（期限なし） | ❌ エラー |

**重要**: トークンエスクローには必ず`CancelAfter`を指定する必要があります。これは、トークンが永久にロックされることを防ぐための仕様です。

### Condition（暗号条件）

エスクローに暗号条件を設定することで、特定の条件が満たされた時のみ資金を解放できます。

- **形式**: 16進数文字列（例: `A0258020...`）
- **必須/オプション**: オプション（指定しない場合、条件なし）
- **サポートタイプ**: PREIMAGE-SHA-256のみ
- **効果**: 対応するFulfillmentを提供することでエスクローを完了可能

#### ConditionとFulfillmentの生成

```typescript
import * as crypto from 'crypto';
const cc = require('five-bells-condition');

// 32バイトのランダムなpreimageを生成
const preimageData = crypto.randomBytes(32);

// PreimageSha256のフルフィルメントを作成
const myFulfillment = new cc.PreimageSha256();
myFulfillment.setPreimage(preimageData);

// Conditionを取得（エスクロー作成時に使用）
const condition = myFulfillment.getConditionBinary().toString('hex').toUpperCase();

// Fulfillmentを取得（エスクロー完了時に使用）
const fulfillment = myFulfillment.serializeBinary().toString('hex').toUpperCase();
```

### フィールドの組み合わせパターン

#### パターン1: FinishAfterのみ（XRPのみ）
```typescript
import { isoTimeToRippleTime } from 'xrpl';

{
  FinishAfter: isoTimeToRippleTime(new Date(Date.now() + 60 * 1000).toISOString()),
  // CancelAfterなし = 期限なし
}
```
- **効果**: 60秒後から完了可能、期限なし

#### パターン2: CancelAfterのみ
```typescript
import { isoTimeToRippleTime } from 'xrpl';

{
  // FinishAfterなし = 即座に完了可能
  CancelAfter: isoTimeToRippleTime(new Date(Date.now() + 300 * 1000).toISOString()),
}
```
- **効果**: 即座に完了可能、300秒後に期限切れ

#### パターン3: 両方指定（推奨）
```typescript
import { isoTimeToRippleTime } from 'xrpl';

{
  FinishAfter: isoTimeToRippleTime(new Date(Date.now() + 60 * 1000).toISOString()),   // 1分後から完了可能
  CancelAfter: isoTimeToRippleTime(new Date(Date.now() + 300 * 1000).toISOString()),  // 5分後に期限切れ
}
```
- **効果**: 60秒後から完了可能、300秒後に期限切れ
- **有効期間**: 60秒後〜300秒後の4分間

#### パターン4: 条件付き（Conditionあり）
```typescript
import { isoTimeToRippleTime } from 'xrpl';

{
  Condition: "A0258020...",  // 暗号条件
  FinishAfter: isoTimeToRippleTime(new Date(Date.now() + 60 * 1000).toISOString()),
  CancelAfter: isoTimeToRippleTime(new Date(Date.now() + 300 * 1000).toISOString()),
}
```
- **効果**: 60秒後から完了可能、かつ正しいFulfillmentが必要

#### パターン5: 条件のみ（即座に完了可能）
```typescript
import { isoTimeToRippleTime } from 'xrpl';

{
  Condition: "A0258020...",  // 暗号条件
  CancelAfter: isoTimeToRippleTime(new Date(Date.now() + 300 * 1000).toISOString()),
}
```
- **効果**: 即座に完了可能、かつ正しいFulfillmentが必要、300秒後に期限切れ

### エスクローの状態遷移

```
作成時 → [Held状態]
  ↓
FinishAfter経過 → [Ready状態]
  ↓              ↓
完了              期限切れ（CancelAfter経過）
  ↓              ↓
受取人に送金      キャンセル可能 → 送信者に返金
```

### 時間精度の注意点

- **レジャー時間**: エスクローの時間判定はレジャーのクローズ時間に基づく
- **誤差**: 実際の時間とレジャー時間には約5秒の誤差がある可能性がある
- **推奨**: 重要なタイミングには余裕を持った時間設定を行う

## 🚀 実行方法

### XRPエスクロー

#### 1. XRPエスクローの作成

```bash
npx tsx src/xrpl/Escrow/escrowCreate.ts
```

**機能:**
- 10 XRPをエスクローにロック
- 1分後に利用可能（FinishAfter）
- 5分後に期限切れ（CancelAfter）

**予想される結果:**
- エスクローオブジェクトが作成される
- 送信者のXRP残高が減少する
- エスクローIDが生成される

#### 2. XRPエスクローの完了

```bash
npx tsx src/xrpl/Escrow/escrowFinish.ts
```

**機能:**
- FinishAfter時間が経過したエスクローを完了
- 受取人にXRPが送信される
- エスクローオブジェクトが削除される

**予想される結果:**
- 受取人のXRP残高が増加する
- エスクローオブジェクトが削除される

#### 3. XRPエスクローのキャンセル

```bash
npx tsx src/xrpl/Escrow/escrowCancel.ts
```

**機能:**
- 期限切れエスクローをキャンセル
- 送信者にXRPが返却される
- エスクローオブジェクトが削除される

**予想される結果:**
- 送信者のXRP残高が増加する
- エスクローオブジェクトが削除される

### 条件付きXRPエスクロー

#### 1. 条件付きXRPエスクローの作成

```bash
npx tsx src/xrpl/Escrow/conditionalEscrowCreate.ts
```

**機能:**
- 10 XRPを条件付きエスクローにロック
- PREIMAGE-SHA-256暗号条件を設定
- 1分後に利用可能（FinishAfter）
- 5分後に期限切れ（CancelAfter）

**前提条件:**
- `five-bells-condition`ライブラリがインストールされている

**予想される結果:**
- 条件付きエスクローオブジェクトが作成される
- ConditionとFulfillmentが生成される
- Fulfillmentが安全に保存される（完了時に必要）

#### 2. 条件付きXRPエスクローの完了

```bash
npx tsx src/xrpl/Escrow/conditionalEscrowFinish.ts
```

**機能:**
- FinishAfter時間が経過した条件付きエスクローを完了
- 正しいFulfillmentを提供してエスクローを完了
- 受取人にXRPが送信される
- エスクローオブジェクトが削除される

**前提条件:**
- エスクロー作成時に生成されたFulfillmentが必要
- FinishAfter時間が経過している

**予想される結果:**
- 受取人のXRP残高が増加する
- エスクローオブジェクトが削除される

### トークンエスクロー

#### 0. TrustLine Lockingの有効化（発行者のみ・IOU用）

```bash
npx tsx src/xrpl/AccountSet/enableTrustLineLocking.ts
```

**機能:**
- 発行者アカウントに`lsfAllowTrustLineLocking`フラグを設定
- 発行したIOUトークンをエスクローで使用可能にする

**前提条件:**
- 発行者アカウントで実行する必要がある

**予想される結果:**
- アカウントに`lsfAllowTrustLineLocking`フラグが設定される
- 発行したIOUトークンがエスクローで使用可能になる

**重要**: 
- このフラグが設定されていない場合、IOUエスクローは`tecNO_PERMISSION`で失敗
- **MPTの場合は不要**（MPT作成時に`tfMPTCanEscrow`フラグを設定）

#### 1. トークンエスクローの作成

```bash
npx tsx src/xrpl/Escrow/tokenEscrowCreate.ts
```

**機能:**
- 1 IOUをエスクローにロック
- 1分後に利用可能（FinishAfter）
- 5分後に期限切れ（CancelAfter）

**前提条件:**
- **IOU**: 発行者が`lsfAllowTrustLineLocking`を有効化済み
- **MPT**: `tfMPTCanEscrow`と`tfMPTCanTransfer`フラグが有効
- 送信者にIOU TrustLineが設定されている
- 送信者に十分なIOU残高がある
- 送信者が認証されている（認証が必要な場合）

**予想される結果:**
- トークンエスクローオブジェクトが作成される
- 送信者のIOU残高が減少する（IOUの場合）
- 送信者のMPT LockedAmountが増加する（MPTの場合）
- エスクローIDが生成される

#### 2. トークンエスクローの完了

```bash
npx tsx src/xrpl/Escrow/tokenEscrowFinish.ts
```

**機能:**
- FinishAfter時間が経過したトークンエスクローを完了
- 受取人にIOUが送信される
- 必要に応じて受取人のTrustLineが自動作成される
- エスクローオブジェクトが削除される

**予想される結果:**
- 受取人のIOU残高が増加する
- エスクローオブジェクトが削除される

#### 3. トークンエスクローのキャンセル

```bash
npx tsx src/xrpl/Escrow/tokenEscrowCancel.ts
```

**機能:**
- 期限切れトークンエスクローをキャンセル
- 送信者にIOUが返却される
- エスクローオブジェクトが削除される

**予想される結果:**
- 送信者のIOU残高が増加する
- エスクローオブジェクトが削除される

## 🔄 実行順序

### XRPエスクローの場合
1. **エスクロー作成**: `escrowCreate.ts`を実行
2. **待機**: FinishAfter時間（1分）を待つ
3. **エスクロー完了**: `escrowFinish.ts`を実行
   - または
4. **エスクローキャンセル**: `escrowCancel.ts`を実行（期限切れ後）

### 条件付きXRPエスクローの場合
1. **条件付きエスクロー作成**: `conditionalEscrowCreate.ts`を実行
2. **Fulfillment保存**: 生成されたFulfillmentを安全に保存
3. **待機**: FinishAfter時間（1分）を待つ
4. **条件付きエスクロー完了**: `conditionalEscrowFinish.ts`を実行（Fulfillmentが必要）
   - または
5. **エスクローキャンセル**: `escrowCancel.ts`を実行（期限切れ後）

### トークンエスクロー（IOU）の場合
1. **TrustLine Locking有効化**: `src/xrpl/AccountSet/enableTrustLineLocking.ts`を実行（発行者アカウント）
2. **TrustLine設定**: `trustSet.ts`を実行してIOU TrustLineを設定（ユーザーアカウント）
3. **IOU送金**: `sendIOU.ts`を実行して送信者にIOUを送金
4. **トークンエスクロー作成**: `tokenEscrowCreate.ts`を実行
5. **待機**: FinishAfter時間（1分）を待つ
6. **トークンエスクロー完了**: `tokenEscrowFinish.ts`を実行
   - または
7. **トークンエスクローキャンセル**: `tokenEscrowCancel.ts`を実行（期限切れ後）

### トークンエスクロー（MPT）の場合
1. **MPT作成**: `mptokenIssuanceCreate.ts`で`tfMPTCanEscrow`と`tfMPTCanTransfer`を有効化
2. **MPT認証**: `mptokenAuthorizeByUser.ts`と`mptokenAuthorizeByIssuer.ts`を実行（認証が必要な場合）
3. **トークンエスクロー作成**: `tokenEscrowCreate.ts`を実行（MPTの`Amount`を指定）
4. **待機**: FinishAfter時間（1分）を待つ
5. **トークンエスクロー完了**: `tokenEscrowFinish.ts`を実行
   - または
6. **トークンエスクローキャンセル**: `tokenEscrowCancel.ts`を実行（期限切れ後）

## ⚙️ 環境変数

以下の環境変数が使用されます：

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `USER_SEED` | 送信者アカウントのシード | ✅ |
| `ISUEER_SEED` | 受取人アカウントのシード | ✅ |
| `IOU_CURRENCY` | IOU通貨コード（トークンエスクローのみ） | ✅ |

**注意**: エスクローの時間設定（FinishAfter、CancelAfter）はコード内で直接指定されています。
- FinishAfter: 現在時刻から60秒後（1分）
- CancelAfter: 現在時刻から300秒後（5分）

## 🔐 トークンエスクローの要件と仕様

XLS-0085（TokenEscrow Amendment）に基づく詳細な要件です。

### Trust Line Tokens（IOU）の要件

#### 発行者側の設定

**1. Allow Trust Line Lockingフラグの有効化（必須）**
```bash
npx tsx src/xrpl/AccountSet/enableTrustLineLocking.ts
```

- **フラグ名**: `lsfAllowTrustLineLocking` (0x40000000)
- **AccountSetフラグ**: `asfAllowTrustLineLocking` (17)
- **目的**: 発行したIOUトークンをエスクローで保持可能にする
- **設定者**: 発行者アカウントのみ
- **エラー**: 未設定の場合、`tecNO_PERMISSION`で失敗

**重要**: このフラグが設定されていない場合、そのIOUを使用したエスクロー作成は`tecNO_PERMISSION`エラーで失敗します。

#### 送信者（エスクロー作成者）の要件

- ✅ 発行者とのTrustLineが設定されている
- ✅ 十分なIOU残高がある
- ✅ 認証が必要な場合、発行者から事前認証されている
- ✅ トークンが凍結されていない（Global/Individual/Deep Freeze）
- ❌ 発行者自身はエスクローの送信者になれない

#### 受取人（エスクロー完了時）の要件

- ✅ 発行者とのTrustLineが設定されている（または自動作成）
- ✅ 認証が必要な場合、発行者から事前認証されている
- ⚠️ Deep Freeze状態の場合、`EscrowFinish`は失敗
- ✅ Global/Individual Freeze状態でも`EscrowFinish`は成功

### Multi-Purpose Tokens（MPT）の要件

#### 発行者側の設定（MPTokenIssuance）

**1. Can Escrowフラグの有効化（必須）**
- **フラグ名**: `tfMPTCanEscrow`
- **設定時期**: MPT作成時（`MPTokenIssuanceCreate`）
- **エラー**: 未設定の場合、`tecNO_PERMISSION`で失敗

**2. Can Transferフラグの有効化（必須）**
- **フラグ名**: `tfMPTCanTransfer`
- **設定時期**: MPT作成時（`MPTokenIssuanceCreate`）
- **例外**: 宛先が発行者の場合は不要
- **エラー**: 未設定の場合、`tecNO_PERMISSION`で失敗

#### 送信者（エスクロー作成者）の要件

- ✅ MPTを保有している
- ✅ 十分なMPT残高がある
- ✅ 認証が必要な場合、発行者から事前認証されている
- ✅ MPTがロックされていない
- ❌ 発行者自身はエスクローの送信者になれない

#### 受取人（エスクロー完了時）の要件

- ✅ MPTを保有している（または自動作成）
- ✅ 認証が必要な場合、発行者から事前認証されている
- ⚠️ MPTがロック状態の場合、`EscrowFinish`は失敗

### TransferRate / TransferFee（送金手数料）

#### エスクロー作成時の動作

- **ロック**: `TransferRate`（IOU）または`TransferFee`（MPT）が**エスクロー作成時にロック**される
- **保存**: エスクローオブジェクトに保存される
- **適用時期**: エスクロー完了時に適用される

#### 重要な特徴

- ✅ 発行者が後で変更しても、エスクロー完了時は**作成時の値**が適用される
- ✅ 受取人は最終的に受け取る金額を予測可能
- ⚠️ 手数料により、受取人が受け取る金額は元の金額より少なくなる可能性がある

### 凍結・ロック条件の詳細

#### IOU Tokens

| 凍結タイプ | EscrowCreate | EscrowFinish | EscrowCancel |
|-----------|--------------|--------------|--------------|
| **Global Freeze** | ❌ 失敗 | ✅ 成功 | ✅ 成功 |
| **Individual Freeze** | ❌ 失敗 | ✅ 成功 | ✅ 成功 |
| **Deep Freeze** | ❌ 失敗 | ❌ 失敗 | ✅ 成功 |

#### Multi-Purpose Tokens

| ロック状態 | EscrowCreate | EscrowFinish | EscrowCancel |
|-----------|--------------|--------------|--------------|
| **Lock Conditions<br>(Deep Freeze相当)** | ❌ 失敗 | ❌ 失敗 | ✅ 成功 |

**重要**: Deep Freeze/Lock状態でも`EscrowCancel`は実行可能（資金は送信者に返却される）

### CancelAfterの必須要件

| エスクロータイプ | CancelAfter |
|---------------|-------------|
| XRPエスクロー | オプション（期限なしも可） |
| **IOU/MPTエスクロー** | **必須** |

**理由**: トークンが永久にロックされることを防ぐため

### 認証（Authorization）の詳細

#### 認証が必要なトークン（lsfRequireAuth / tfMPTRequireAuth）の場合

**エスクロー作成時:**
- ✅ 送信者が事前認証されている必要がある
- ❌ 未認証の場合、`tecNO_AUTH`で失敗

**エスクロー完了時:**
- ✅ 受取人が事前認証されている必要がある
- ❌ 未認証の場合、`tecNO_AUTH`で失敗
- ⚠️ `EscrowFinish`中に認証を付与することはできない

**エスクローキャンセル時:**
- ✅ 送信者が認証されている必要がある
- ❌ 未認証の場合、トークンを返却できない

### TrustLine / MPToken の自動作成

#### 条件
- ✅ トークンが認証を要求しない
- ✅ トランザクション送信者が受取人である

#### 動作
- **IOU**: TrustLineが自動作成される
- **MPT**: MPTokenが自動作成される

#### エラーケース
- ❌ 認証が必要な場合: `tecNO_AUTH`
- ❌ リザーブ不足の場合: `tecINSUFFICIENT_RESERVE`

## 💡 使用例とユースケース

### 1. 時間ベースエスクロー
- **用途**: 定期支払い、時間制限付き取引
- **例**: 1週間後に給与を支払う、30日後に商品代金を支払う

### 2. 条件付きエスクロー
- **用途**: 条件付き支払い、スマートコントラクト
- **例**: 商品到着確認後に支払い、特定の条件達成後に報酬支払い

### 3. 組み合わせエスクロー
- **用途**: 複雑な条件付き支払い
- **例**: 1週間後かつ特定条件達成後に支払い

## ⚠️ 制限事項

### 共通制限事項

1. **コスト**: エスクローには2つのトランザクションが必要（作成と完了/キャンセル）
2. **リザーブ要件**: エスクロー作成者は`Escrow`オブジェクトのリザーブ要件を負担
3. **暗号条件**: 現在サポートされているのはPREIMAGE-SHA-256のみ
4. **時間精度**: 実際の解放/期限切れ時間は約5秒の誤差がある場合がある
5. **過去の時間**: 過去の時間値でエスクローを作成することはできない
6. **アカウント削除**: エスクローが存在するアカウントは削除できない

### XRPエスクロー固有の制限

1. **CancelAfter**: オプション（指定しない場合、期限なし）

### トークンエスクロー固有の制限

1. **期限必須**: IOU/MPTエスクローには期限（CancelAfter）が**必須**
2. **発行者制限**: 
   - **IOU**: 発行者が`lsfAllowTrustLineLocking`を有効化する必要がある
   - **MPT**: `tfMPTCanEscrow`と`tfMPTCanTransfer`フラグが必要
3. **発行者の参加制限**: 発行者自身はエスクローの送信者になれない
4. **認証要件**: 
   - 認証が必要なトークンの場合、送信者と受取人の両方が事前認証されている必要がある
   - エスクロー完了中に認証を付与することはできない
5. **凍結/ロック制限**: 
   - Deep Freeze/Lock状態のトークンはエスクロー完了できない
   - エスクローキャンセルは可能
6. **TransferRate/TransferFee**: 
   - エスクロー作成時の値がロックされる
   - 受取人が受け取る金額は手数料により減少する可能性がある
7. **Clawback**: 
   - アクティブなエスクロー内では直接のclawbackメカニズムはない
   - エスクローを完了/キャンセル後に通常のclawback機能を使用可能

## 🔍 エラーコード

### 共通エラー

| エラーコード | 説明 | 対処法 |
|-------------|------|--------|
| `temBAD_EXPIRATION` | 期限設定無効 | 未来の時間を指定する |
| `tecNO_ENTRY` | エスクローなし | エスクローIDを確認する |
| `tecCRYPTOCONDITION_ERROR` | 暗号条件エラー | 正しいFulfillmentを確認する |
| `tecINVALID_ACCOUNT` | 無効なアカウント | アカウント情報を確認する |
| `temDISABLED` | Amendmentが無効 | TokenEscrow Amendmentが有効か確認する |

### XRPエスクロー固有エラー

| エラーコード | 説明 | 対処法 |
|-------------|------|--------|
| `tecUNFUNDED_PAYMENT` | XRP残高不足 | 十分なXRPを確保する |

### トークンエスクロー固有エラー

| エラーコード | 説明 | 対処法 |
|-------------|------|--------|
| `tecNO_PERMISSION` | 権限なし | **IOU**: `lsfAllowTrustLineLocking`を有効化<br>**MPT**: `tfMPTCanEscrow`と`tfMPTCanTransfer`を確認<br>**発行者**: 発行者自身はエスクローの送信者になれない |
| `tecUNFUNDED` | トークン残高不足 | 十分なIOU/MPT残高を確保する |
| `tecOBJECT_NOT_FOUND` | MPTokenが存在しない | MPTを保有しているか確認する |
| `tecNO_LINE` | TrustLineなし | 先にTrustSetを実行する |
| `tecNO_AUTH` | 認証なし | 発行者による事前認証が必要<br>エスクロー完了中に認証は付与できない |
| `tecFROZEN` | トークン凍結/ロック | **IOU**: Deep Freeze状態を解除<br>**MPT**: Lock状態を解除<br>**注**: Global/Individual Freezeは`EscrowFinish`を阻害しない |
| `tecINSUFFICIENT_RESERVE` | リザーブ不足 | TrustLine/MPToken自動作成に必要なリザーブを確保 |
| `temBAD_AMOUNT` | 金額が無効 | 正の値を指定する |
| `temBAD_CONDITION` | 条件が無効 | 正しいCondition形式を指定する |
| `tecINVALID_FLAG` | 無効なフラグ | `asfAllowTrustLineLocking` (17)を確認する |

## 📚 参考文献

### 公式ドキュメント
- [XRPL Escrow Documentation](https://xrpl.org/ja/docs/concepts/payment-types/escrow)
- [XLS-0085: TokenEscrow Amendment](https://xls.xrpl.org/xls/XLS-0085-token-escrow.html)
- [TokenEscrow 日本語解説](https://xrpl.org/ja/docs/concepts/payment-types/escrow#token-escrow)

### トランザクションリファレンス
- [EscrowCreate Transaction](https://xrpl.org/ja/docs/references/protocol/transactions/types/escrowcreate)
- [EscrowFinish Transaction](https://xrpl.org/ja/docs/references/protocol/transactions/types/escrowfinish)
- [EscrowCancel Transaction](https://xrpl.org/ja/docs/references/protocol/transactions/types/escrowcancel)
- [AccountSet Transaction](https://xrpl.org/ja/docs/references/protocol/transactions/types/accountset)

### レジャーオブジェクトリファレンス
- [Escrow Object](https://xrpl.org/ja/docs/references/protocol/ledger-data/ledger-entry-types/escrow)
- [AccountRoot Object](https://xrpl.org/ja/docs/references/protocol/ledger-data/ledger-entry-types/accountroot)
- [MPToken Object](https://xrpl.org/ja/docs/references/protocol/ledger-data/ledger-entry-types/mptoken)
- [MPTokenIssuance Object](https://xrpl.org/ja/docs/references/protocol/ledger-data/ledger-entry-types/mptokenissuance)

### 関連機能
- [Crypto-Conditions](https://tools.ietf.org/html/draft-thomas-crypto-conditions-04)
- [Multi-Purpose Tokens (XLS-33)](https://xls.xrpl.org/xls/XLS-0033-multi-purpose-tokens/README.html)