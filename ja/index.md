---
title: Dagu 導入ドキュメント
description: SIer・情報システム部門向けの Dagu 導入ドキュメントです。動作環境、高可用性、運用、セキュリティ、移行手順をまとめています。
---

# Dagu 導入ドキュメント

Dagu は、ジョブのスケジュール実行と管理を 1 つのバイナリで行うワークフローエンジンです。定義は YAML で記述し、状態はファイルに保存します。データベースやメッセージブローカーは必要ありません。

このサイトでは、導入の判断と構築に必要なページを日本語で提供しています。ワークフローの書き方など機能の詳細は、[英語のドキュメント](/)を参照してください。

## 目的別の入口

| 目的 | ページ |
| --- | --- |
| 導入可否を判断する | [導入資料の一覧](/ja/enterprise/) |
| 非機能要件を確認する | [非機能要求グレード対応表](/ja/enterprise/non-functional-requirements) |
| 動作環境とサイジングを確認する | [動作環境](/ja/server-admin/system-requirements) |
| インストールする | [インストール](/ja/getting-started/installation/) |
| 二重化する | [高可用性](/ja/server-admin/deployment/high-availability) |
| インターネットに接続せずに使う | [閉域網](/ja/server-admin/deployment/closed-network) |
| 運用する | [バックアップと復旧](/ja/server-admin/backup-restore)、[アップグレード](/ja/server-admin/upgrades)、[トラブルシューティング](/ja/server-admin/troubleshooting) |
| 既存のジョブ管理製品から移行する | [JP1/AJS3 から](/ja/migration/from-jp1)、[Rundeck から](/ja/migration/from-rundeck) |
| ライセンスを確認する | [プランとライセンス](/ja/overview/self-host-license)、[ライセンス FAQ](/ja/overview/licensing-faq) |
