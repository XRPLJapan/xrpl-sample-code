# Permissioned Domains機能の追加

## 📝 概要

XRPLのPermissioned Domains機能を管理するサンプルコード集を追加しました。この機能により、Permissioned DEXやレンディングプロトコルなどの機能でアクセス制御を実現できます。

## 🚀 追加内容

### 新しいディレクトリ構造
```
src/xrpl/PermissionedDomains/
├── permissionedDomainSet.ts      # ドメイン作成・更新
├── permissionedDomainDelete.ts   # ドメイン削除
└── README.md                     # ドキュメント
```

### 実装ファイル

#### `permissionedDomainSet.ts`
- 新しいPermissioned Domainを作成
- AcceptedCredentials（承認された資格情報）リストを設定
- Domain IDを取得して表示
- 既存のDomainを更新する機能もサポート（DomainIDを指定）
- 型安全なDomainID取得ロジック
- エラーハンドリングとヒントメッセージ

#### `permissionedDomainDelete.ts`
- 指定されたDomain IDのドメインを削除
- 準備金がアカウントに返却される
- エラーハンドリングとヒントメッセージ

### ドキュメント

#### `README.md`
包括的なドキュメントを作成：
- **概要**: Permissioned Domainsの説明と主な特徴
- **実行方法**: 各スクリプトの実行コマンドと説明
- **実行順序**: フロー全体のテスト手順
- **予想される結果**: 成功時と失敗時の詳細なケース
- **AcceptedCredentialsの構造**: 設定方法の詳細
- **重要な注意点**: Credentialが台帳に存在しなくても設定可能
- **Amendment要件**: 必要なAmendmentの情報
- **参考文献**: XRPLドキュメントへのリンク

## 🔧 技術的な改善点

### 型安全性の向上
- `TransactionMetadataBase`型を使用
- 型ガードによる安全なDomainID取得
- `any`型の使用を避けた型安全な実装

### エラーハンドリング
- 詳細なエラーメッセージとヒント
- よくあるエラーケースの説明

### ユーザビリティ
- DomainIDの自動取得と表示
- 次のステップへのガイダンス
- エクスプローラーURLの表示

## 📋 メインREADMEの更新

- ディレクトリ構造にPermissionedDomainsを追加
- フォルダ別READMEリストにPermissionedDomainsを追加

## ⚠️ 重要な注意事項

- **Amendment要件**: PermissionedDomainsとCredentials Amendmentが必要
- **現在の状況**: Mainnet/Testnetではまだ有効になっていない
- **Credential設定**: 台帳に存在しないCredentialでも事前設定可能

## 🧪 テスト

- TypeScriptビルドが成功
- リンターエラーなし
- 既存のプロジェクト構造に準拠

## 📚 参考資料

- [XRPL - Permissioned Domains (Concepts)](https://xrpl.org/ja/docs/concepts/tokens/decentralized-exchange/permissioned-domains)
- [XRPL - PermissionedDomainSet](https://xrpl.org/ja/docs/references/protocol/transactions/types/permissioneddomainset)
- [XRPL - PermissionedDomainDelete](https://xrpl.org/ja/docs/references/protocol/transactions/types/permissioneddomaindelete)

## 🎯 今後の展望

この機能は将来の以下のAmendmentで使用される予定です：
- Single Asset Vault (XLS-65d)
- Lending Protocol (XLS-66d)
- Permissioned DEXes
