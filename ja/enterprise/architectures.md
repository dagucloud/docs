---
title: 構成例
description: Dagu の代表的な構成である単一ノード、アクティブ/スタンバイ、分散ワーカーの特徴と、必要なもの、選び方をまとめました。
---

# 構成例

要件を満たす最も単純な構成を選んでください。構成要素が増えるほど、用意と運用の手間が増えます。

| 要件 | 構成 |
| --- | --- |
| ホストの障害時は、手動の復旧で間に合う | [単一ノード](#single-node) |
| ホストの障害でスケジュールを止めたくない | [アクティブ/スタンバイ](#active-standby) |
| ジョブを別のホストやネットワークで動かしたい | [分散ワーカー](#distributed-workers) |
| 閉域網の中で集中監視とアラートが必要 | [社内に置く Dagu Console](#private-console) |

## 単一ノード {#single-node}

```text
 +--------------------------+
 | Host                     |
 |   dagu start-all         |
 |   (Web UI + scheduler)   |
 |   local disk             |
 +--------------------------+
```

| 項目 | 内容 |
| --- | --- |
| 必要なもの | ホスト 1 台 |
| ライセンス | 1 サーバー |
| ホスト障害時の影響 | 復旧するまでスケジュールは止まります。 |
| 復旧の方法 | ホストの再起動、または別ホストへの[バックアップからの復旧](/ja/server-admin/backup-restore) |
| 手順 | [Linux (systemd)](/ja/server-admin/deployment/systemd)、[Windows サービス](/ja/server-admin/deployment/windows) |

## アクティブ/スタンバイ {#active-standby}

```text
       Host A                         Host B
 +-------------------+          +-------------------+
 | dagu scheduler    |          | dagu scheduler    |
 |   ACTIVE          |          |   STANDBY         |
 | dagu server       |          | dagu server       |
 +---------+---------+          +---------+---------+
           |                              |
           +-------------+  +-------------+
                         v  v
                  Shared storage (NFS)
```

| 項目 | 内容 |
| --- | --- |
| 必要なもの | ホスト 2 台、冗長化した共有ストレージ、時刻同期、再起動の仕組み、必要に応じてロードバランサー |
| ライセンス | データディレクトリを共有する 2 台で 1 サーバー |
| ホスト障害時の影響 | 既定の設定で 40 秒以内 (起動処理の時間を除く) にスタンバイが引き継ぎます。障害が起きたホストで実行中のジョブは失敗扱いになります。 |
| 残るリスク | 共有ストレージの障害、拠点全体の障害 |
| 手順 | [高可用性](/ja/server-admin/deployment/high-availability) |

## 分散ワーカー {#distributed-workers}

```text
 +----------------------------+
 | Dagu server                |
 |   scheduler, coordinator   |
 +-------------+--------------+
               ^  gRPC (mTLS)
       +-------+--------+
       |                |
 +-----+------+   +-----+------+
 | dagu worker|   | dagu worker|
 | labels: A  |   | labels: B  |
 +------------+   +------------+
```

ワーカーはコーディネーターへ外向きに接続するため、分離されたネットワークでも受信ポートを開ける必要はありません。

| 項目 | 内容 |
| --- | --- |
| 必要なもの | サーバー 1 台以上、ワーカー、証明書 (mTLS の場合) |
| ライセンス | Dagu サーバーの台数分。ワーカーは数えません。 |
| ワーカー障害時の影響 | そのワーカーで実行中のジョブが影響を受けます。 |
| 手順 | [Distributed Execution](/server-admin/distributed/) (英語) |

アクティブ/スタンバイと分散ワーカーは組み合わせられます。Kubernetes の場合は [Helm チャートの分散モード](/server-admin/deployment/kubernetes#distributed-mode) (英語) を参照してください。

## 社内に置く Dagu Console {#private-console}

```text
 +----------------------------+
 | Private Dagu Console       |
 | (inside your network)      |
 +-------------+--------------+
               ^  HTTPS (reports)
       +-------+--------+
       |                |
 +-----+------+   +-----+------+
 | Dagu server|   | Dagu server|
 +------------+   +------------+
```

Enterprise 契約のもとで、ご依頼に応じて提供します。範囲と時期は案件ごとに取り決めます。

| 項目 | 内容 |
| --- | --- |
| 必要なもの | Console 用のホスト、PostgreSQL、社内のメールサーバーまたは通知先 |
| ライセンス | Enterprise 契約 |
| Dagu サーバー障害時の影響 | Console はサーバーとは別に動くため、報告が途絶えたことをアラートできます。 |
| Console 障害時の影響 | アラートは止まりますが、ジョブは動き続けます。 |
| 手順 | [閉域網](/ja/server-admin/deployment/closed-network#private-dagu-console) |

## 環境の分離 {#environments}

本番、検証、開発は別のサーバーに分けることを推奨します。手順は [Multi-Environment Deployments](/server-admin/deployment/multi-environment) (英語) を参照してください。
