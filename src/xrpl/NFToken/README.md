# NFToken（NFT）機能

XRP Ledgerの非代替性トークン（NFT）の発行・管理機能を提供します。

## 📚 概要

NFTokenは、デジタルアート、コレクティブル、ゲームアイテムなど、一意性を持つデジタル資産を表現するために使用されます。

## 🔧 実装機能

### 1. NFToken Mint（NFT発行）
- **ファイル**: `nftokenMint.ts`
- **説明**: 新しいNFTを作成します
- **トランザクションタイプ**: `NFTokenMint`
- **実行コマンド**:
```bash
npx tsx src/xrpl/NFToken/nftokenMint.ts
```

### 1-2. NFToken Mint with Offer（NFT発行と同時にオファー作成）
- **ファイル**: `nftokenMintOffer.ts`
- **説明**: NFTを発行すると同時に売却オファーを作成します
- **トランザクションタイプ**: `NFTokenMint` (AmountとDestinationフィールド付き)
- **実行コマンド**:
```bash
npx tsx src/xrpl/NFToken/nftokenMintOffer.ts
```

### 2. NFToken Burn（NFT焼却）
- **ファイル**: `nftokenBurn.ts`
- **説明**: 所有しているNFTを焼却（削除）します
- **トランザクションタイプ**: `NFTokenBurn`
- **実行コマンド**:
```bash
npx tsx src/xrpl/NFToken/nftokenBurn.ts
```

### 3. NFToken Create Offer（売買オファー作成）
- **ファイル**: `nftokenCreateOffer.ts`
- **説明**: NFTの売買オファーを作成します（売却オファーまたは購入オファー）
- **トランザクションタイプ**: `NFTokenCreateOffer`
- **実行コマンド**:
```bash
npx tsx src/xrpl/NFToken/nftokenCreateOffer.ts
```

### 4. NFToken Accept Offer（オファー受諾）
- **ファイル**: `nftokenAcceptOffer.ts`
- **説明**: NFTの売買オファーを受諾します
- **トランザクションタイプ**: `NFTokenAcceptOffer`
- **実行コマンド**:
```bash
npx tsx src/xrpl/NFToken/nftokenAcceptOffer.ts
```

### 5. NFToken Cancel Offer（オファーキャンセル）
- **ファイル**: `nftokenCancelOffer.ts`
- **説明**: 作成した売買オファーをキャンセルします
- **トランザクションタイプ**: `NFTokenCancelOffer`
- **実行コマンド**:
```bash
npx tsx src/xrpl/NFToken/nftokenCancelOffer.ts
```

### 6. Dynamic NFT（ダイナミックNFT）
- **ファイル**: `nftokenDynamic.ts`
- **説明**: 変更可能なNFTを発行し、後からURIを更新します
- **トランザクションタイプ**: `NFTokenMint` (tfMutableフラグ付き) + `NFTokenModify`
- **実行コマンド**:
```bash
npx tsx src/xrpl/NFToken/nftokenDynamic.ts
```
- **参考**: [公式ドキュメント - ダイナミックNFT](https://xrpl.org/ja/docs/concepts/tokens/nfts/dynamic-nfts)

## 🎯 基本的な使用フロー

### パターン1: NFTの発行と売買（2ステップ）

1. **NFTの発行**
```bash
npx tsx src/xrpl/NFToken/nftokenMint.ts
# → NFTokenIDが発行される
```

2. **売却オファーの作成**（発行者が売却）
```bash
npx tsx src/xrpl/NFToken/nftokenCreateOffer.ts
# → 売却オファーIDが作成される
```

3. **オファーの受諾**（購入者が受諾）
```bash
npx tsx src/xrpl/NFToken/nftokenAcceptOffer.ts
# → NFTの所有権が移転
```

### パターン2: NFTの発行と売却オファーを同時に作成（1ステップ）

1. **NFTの発行 + 売却オファー作成**
```bash
npx tsx src/xrpl/NFToken/nftokenMintOffer.ts
# → NFTokenIDと売却オファーIDが同時に作成される
```

2. **オファーの受諾**（購入者が受諾）
```bash
npx tsx src/xrpl/NFToken/nftokenAcceptOffer.ts
# → NFTの所有権が移転
```

### 共通の操作

**NFTの焼却**（不要になったNFTを削除）
```bash
npx tsx src/xrpl/NFToken/nftokenBurn.ts
# → NFTが永久に削除される
```

## 📝 重要な概念

### NFTokenID
- NFTの一意な識別子（256ビット）
- 発行者アドレス、シーケンス番号、タクソンなどから生成
- Mintトランザクション実行後に確認可能

### NFTokenOffer
- NFTの売買オファー
- **Sell Offer**: 所有者が売却価格を提示
- **Buy Offer**: 購入希望者が購入価格を提示

### NFTokenMint フラグ
- `tfBurnable` (1): 発行者が焼却可能
- `tfOnlyXRP` (2): XRPのみで取引可能
- `tfTrustLine` (4): 発行者のTrust Lineを使用（fixRemoveNFTokenAutoTrustLine Amendmentにより、このフラグの設定は無効となった。）
- `tfTransferable` (8): 転送可能

### URI
- NFTのメタデータへのリンク（最大256バイト）
- IPFS、HTTP、その他のURIスキームを使用可能
- 通常、JSONメタデータを指す

### TransferFee
- NFTが転売される際に発行者が受け取る手数料
- 0〜50000の範囲で指定（0% 〜 50%）
- 10000 = 10%の転送手数料

### NFTokenMintと同時にオファーを作成
- **Amount**: NFTの売却価格を指定することで、発行と同時に売却オファーを自動作成
- **Destination**: 特定の購入者を指定（オプション。指定しない場合は誰でも購入可能）
- 1つのトランザクションでNFT発行とオファー作成を効率的に実行可能

### ダイナミックNFT（dNFT）
- **tfMutable**: NFTを変更可能にするフラグ（`0x00000010`）
- **NFTokenModify**: dNFTのURIフィールドを更新するトランザクション
- **ユースケース**: イベントチケットの日程変更、スポーツカードの統計更新など
- 発行後にメタデータを動的に更新できる柔軟性を提供

## ⚠️ エラーケース

### NFTokenMint のエラー

| エラーコード | 説明 |
|------------|------|
| `temDISABLED` | NonFungibleTokensV1 Amendmentが有効ではありません |
| `temBAD_NFTOKEN_TRANSFER_FEE` | TransferFeeが許容範囲外です（0-50000） |
| `temINVALID_FLAG` | 無効なフラグが指定されています |
| `temMALFORMED` | トランザクションが正しく指定されていません（URIは256バイト以下） |
| `tecNO_ISSUER` | Issuerで指定されたアカウントが存在しません |
| `tecNO_PERMISSION` | 発行者の代理としてNFTを発行する権限がありません |
| `tecINSUFFICIENT_RESERVE` | トークン発行後にアカウントの準備金要件を満たせません |
| `tecMAX_SEQUENCE_REACHED` | 発行者のMintedNFTokensフィールドが最大値に達しています |

### NFTokenBurn のエラー

| エラーコード | 説明 |
|------------|------|
| `temDISABLED` | NonFungibleTokensV1 Amendmentが有効ではありません |
| `tecNO_ENTRY` | 指定されたTokenIDが見つかりませんでした |
| `tecNO_PERMISSION` | このアカウントにはトークンをBurnする権限がありません |

### NFTokenCreateOffer のエラー

| エラーコード | 説明 |
|------------|------|
| `temDISABLED` | NonFungibleTokensV1 Amendmentが有効ではありません |
| `temBAD_AMOUNT` | Amountフィールドが無効（購入オファーで金額がゼロ、またはlsfOnlyXRPフラグ有効時にトークンを指定） |
| `temBAD_EXPIRATION` | 指定されたExpirationが無効（0は指定不可） |
| `temMALFORMED` | トランザクションが正しく指定されていません |
| `tecDIR_FULL` | 送信者がすでに多くのオブジェクトを所有しているか、このトークンのオファーが多すぎます |
| `tecEXPIRED` | 指定されたExpirationの時間は既に経過しています |
| `tecFROZEN` | トークンのトラストラインがフリーズされています |
| `tecINSUFFICIENT_RESERVE` | オファー作成後に所有者準備金を満たすのに十分なXRPがありません |
| `tecNO_DST` | Destinationで指定されたアカウントが存在しません |
| `tecNO_ENTRY` | 指定されたNFTokenをアカウントが所有していません |
| `tecNO_ISSUER` | Amountフィールドで指定した発行者が存在しません |
| `tecNO_LINE` | NFTokenの発行者がトークンのトラストラインを持っていません |
| `tecNO_PERMISSION` | Destinationアカウントが着信するNFTokenOfferをブロックしています |
| `tecUNFUNDED_OFFER` | 購入オファーの金額を支払うための資金が不足しています |
| `tefNFTOKEN_IS_NOT_TRANSFERABLE` | NFTokenはlsfTransferableフラグが無効で、転送できません |

### NFTokenAcceptOffer のエラー

| エラーコード | 説明 |
|------------|------|
| `temDISABLED` | NonFungibleTokensV1 Amendmentが有効ではありません |
| `temMALFORMED` | トランザクションのフォーマットが正しくありません |
| `tecCANT_ACCEPT_OWN_NFTOKEN_OFFER` | 購入者と販売者が同じアカウント（自分のオファーは受諾不可） |
| `tecEXPIRED` | オファーの有効期限が既に切れています |
| `tecINSUFFICIENT_FUNDS` | 購入者が申し出た金額を全額持っていません |
| `tecINSUFFICIENT_PAYMENT` | ブローカーモードにおいて、購入額がBrokerFeeおよび売却コストを支払うには不十分 |
| `tecOBJECT_NOT_FOUND` | 指定されたオファーがレジャーに存在しません |
| `tecNFTOKEN_BUY_SELL_MISMATCH` | ブローカーモードにおいて、2つのオファーが有効なマッチングではありません |
| `tecNFTOKEN_OFFER_TYPE_MISMATCH` | 指定されたオファーIDが実際のオファータイプと一致しません |
| `tecNO_PERMISSION` | 販売者がNFTokenを所有していない、またはDestinationの指定が異なります |

### NFTokenCancelOffer のエラー

| エラーコード | 説明 |
|------------|------|
| `temMALFORMED` | NFTokenOffersフィールドが空、または多すぎます |
| `tecNO_ENTRY` | 指定されたオファーが見つかりません |
| `tecNO_PERMISSION` | このオファーをキャンセルする権限がありません |

## 🔗 参考リンク

- [XRP Ledger NFT公式ドキュメント](https://xrpl.org/ja/docs/references/protocol/data-types/nftoken)
- [NFTokenMint](https://xrpl.org/ja/docs/references/protocol/transactions/types/nftokenmintl)
- [NFTokenBurn](https://xrpl.org/ja/docs/references/protocol/transactions/types/nftokenburn)
- [NFTokenCreateOffer](https://xrpl.org/ja/docs/references/protocol/transactions/types/nftokencreateoffer)
- [NFTokenAcceptOffer](https://xrpl.org/ja/docs/references/protocol/transactions/types/nftokenacceptoffer)
- [NFTokenCancelOffer](https://xrpl.org/ja/docs/references/protocol/transactions/types/nftokencanceloffer)

