---
title: 導入資料の一覧
description: SIer・情報システム部門が Dagu の導入を検討するときに使う資料の一覧です。非機能要求グレード対応表、構成例、パラメータシート、運用手順書、チェックシート回答例、PoC 手順があります。
---

# 導入資料の一覧

Dagu の導入を検討する SIer と情報システム部門のための資料です。稟議、要件定義、設計書、受入試験の下書きとしてそのまま使えます。

| 資料 | 使う場面 |
| --- | --- |
| [非機能要求グレード対応表](./non-functional-requirements) | 要件定義で、Dagu が対応する範囲と利用者が用意する範囲を切り分ける |
| [構成例](./architectures) | 単一ノード、二重化、分散から構成を選ぶ |
| [パラメータシート](./parameter-sheet) | 設定値を設計書として残す |
| [運用手順書テンプレート](./runbook-template) | 運用手順書の下書きを作る |
| [セキュリティチェックシート回答例](./security-checksheet) | 顧客や社内のチェックシートに回答する |
| [PoC 手順](./poc) | 本番採用の前に、自社環境で確認する |

## 導入前に確認していただきたいこと

- **サポート:** 修正は最新の安定版リリース系列で提供します。Community、Team、Pro では GitHub Issues と Discord でメンテナーとコミュニティが回答します。応答目標を伴うサポートは Enterprise 契約で提供します。詳しくは[サポート方針](/ja/server-admin/support-policy)を参照してください。
- **二重化:** アクティブ/スタンバイ構成では、共有ストレージ (NFS または `ReadWriteMany` ボリューム) を介してスタンバイがスケジューラを引き継ぎます。障害が起きたホストで実行中だったジョブは失敗としてマークされ、DAG 単位の `retry_policy` で自動的に再実行できます。詳しくは[高可用性](/ja/server-admin/deployment/high-availability)を参照してください。
- **権限:** ロールはサーバー全体またはワークスペース単位で割り当てます。ジョブごとに権限を分けるには、ジョブをワークスペースに分けます。
- **移行:** [JP1/AJS3 から](/ja/migration/from-jp1)と [Rundeck から](/ja/migration/from-rundeck)に、対応表と移行手順があります。定義は YAML のため、スクリプトで変換できます。変換ツールが必要な場合は[リクエストしてください](https://github.com/dagucloud/dagu/issues)。
- **閉域網:** スケジュールとジョブの実行にインターネット接続は不要です。期限超過や開始遅れのアラートを含む集中監視は、Enterprise 契約でご依頼に応じて構築する[社内に置く Control Plane](/ja/server-admin/deployment/closed-network#private-control-plane) で利用できます。[ローカルで動作する機能](/ja/server-admin/deployment/closed-network#alerts-without-dagu-console)でアラートを構成することもできます。

## 相談窓口

商用契約、Enterprise サポート、導入支援については `company@descarty.com` にお問い合わせください。
