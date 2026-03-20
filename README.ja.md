# Hive — マルチプロバイダーAIチームオーケストレーションプラグイン

[English](README.md) | [한국어](README.ko.md) | **[日本語]**

> **v3.1.0** — 7段階品質パイプライン + ハードゲート強制

マルチプロバイダーAIチーム（Claude、Codex、Gemini）を研究に基づいた品質パイプラインでオーケストレーションします。複雑なタスクをチームベースのモジュールに分解し、コンセンサス駆動の設計を強制し、厳格なTDDパイプラインで実行します — リアルタイム可視化ダッシュボード付き。

```
/hive "リアルタイムチャット機能を追加"

  G1 CLARIFY ─→ G2 SPEC ─→ プロンプトEng ─→ ブレスト ─→ Serenaコンテキスト
       ─→ チーム分解 ─→ G3 PLAN REVIEW ─→ コンセンサス
       ─→ G4 TDD RED ─→ G5 IMPLEMENT GREEN ─→ G6 CROSS-VERIFY
       ─→ G7 E2E VALIDATE ─→ 完了
```

---

## 問題

従来のAIコーディングワークフローの根本的な問題：

1. **曖昧なリクエストは曖昧なコードを生む** — 事前の明確化なし
2. **自己検証テスト** — エージェントが自分の前提を確認するテストを書く
3. **責任の所在がない** — 単一エージェントのセルフレビューでは何も検出できない

## Hiveの解決方法

- **必須の明確化**（G1 + G2）— 作業開始前にスコープ/基準/制約を必ず確認
- **エージェント分離** — テスト作成者は実装を見れず、実装者はテスト意図を見れない（CodeDelegatorパターン）
- **マルチエージェント交差検証** — ミューテーションテスト + プロパティベーステスト + クロスモデルレビュー
- **ハードゲート** — 各段階は前のマーカーが存在しなければ進入不可；バイパス不可

研究基盤：AgentSpec (ICSE 2026)、TGen TDD (2024)、Meta ACH (FSE 2025)、CodeDelegator (2025)、Du et al. マルチエージェント討論 (2023)、PGS PBT (FSE 2025)。

---

## 主要機能

### 7ハード品質ゲート

| ゲート | 名前 | 役割 | 進入条件 |
|--------|------|------|----------|
| G1 | CLARIFY | スコープ/成功基準/制約の明確化、多肢選択式（最大3ラウンド） | — |
| G2 | SPEC | 6セクション自然言語仕様、不変条件2個+、境界条件3個+、SHA256ハッシュ | G1通過 |
| G3 | PLAN REVIEW | Designer↔Reviewer相互討論、5次元ルーブリック、スコア >= 7.0 | G2通過 |
| G4 | TDD RED | SPEC基準テスト作成（例示 + プロパティ + スモーク）、全テストFAIL必須 | G3通過 |
| G5 | IMPLEMENT GREEN | 分離された実装者が全テストPASS（最大5回反復） | G4通過 |
| G6 | CROSS-VERIFY | ミューテーションテスト（>= 60%）、PBT（100回+）、クロスモデルレビュー | G5通過 |
| G7 | E2E VALIDATE | 実際の実行検証、モック禁止 | G6通過 |

各ゲートはマーカーファイルを発行します。**マーカーなし＝進行不可。**

### エージェント分離（CodeDelegatorパターン）

```
Agent A (Claude)           Agent B (Codex)          Agent C (Gemini)
├─ SPEC基準テスト作成       ├─ コード実装              ├─ ミューテーション/PBT検証
├─ 実装コードアクセス不可    ├─ テスト意図アクセス不可   ├─ プロセスアクセス不可
└─ SPECのみ参照            └─ テスト+コードベース参照   └─ 両方の結果のみ参照
```

情報障壁によりContext Pollutionを防止 — エージェント間のコンテキスト汚染時に品質低下（Kemple 2025、CP > 0.25閾値）。

### ハッシュチェーン改ざん防止

| 検証時点 | 対象 | 不一致時 |
|----------|------|---------|
| G3進入 | SPECハッシュ | Phase 0へ回帰 |
| G5進入 | テストファイルハッシュ | G4へ回帰 |
| G6進入 | 実装コードハッシュ | G5へ回帰 |

### マルチプロバイダーチーム役割

| 役割 | プロバイダー | 配分 |
|------|------------|------|
| コアロジック / アーキテクチャ | Claude (Agent) | 50-60% |
| 実装 / リファクタリング | Codex | 20-30% |
| リサーチ / テスト / ドキュメント | Gemini | 10-20% |

Codexは**必ず実装**しなければなりません（レビューのみ不可）。Geminiは**必ず参加**しなければなりません。Claude独占禁止。

### コンセンサスプロトコル

すべてのチームは実装前にコンセンサスに到達しなければなりません：

- **AGREE** — 提案されたアプローチを受入
- **COUNTER** — 代替案とともに技術的問題を提起（技術的問題発見時は義務）
- **CLARIFY** — 追加情報を要求

チームあたり最大5ラウンド。膠着時はGeminiが調停（2/3多数決）。5ラウンド後の合意失敗時はリードが最終決定。

### リアルタイムダッシュボード

Next.jsダッシュボードとWebSocketイベントサーバーがオーケストレーションパイプラインをリアルタイムで可視化します：

- **トポロジーグラフ** — エージェント関係とデータフロー（@xyflow/react基盤）
- **パイプラインパネル** — ゲート進行状況とPhase追跡
- **エージェント詳細パネル** — 個別エージェントの状態と出力
- **イベントログ** — リアルタイムイベントストリーム
- **結果サマリー** — 最終実行結果

```bash
# ダッシュボード起動
cd dashboard && npm run dev          # Next.js (localhost:3000)
cd dashboard/server && npm run dev   # WebSocketイベントサーバー
```

---

## アーキテクチャ

### プロジェクト構成

```
hive-plugin/
├── skills/                     # 6スキルモジュール（合計1,778行）
│   ├── hive/                   # エントリポイント — Phaseルーター、ハードゲート、プロバイダールール
│   ├── hive-workflow/          # Phase 0-5エンジン — プロンプトEng、ブレスト、Serena、チーム、実行
│   ├── hive-consensus/         # Phase 4コンセンサス — 双方向AGREE/COUNTER/CLARIFY
│   ├── hive-spawn-templates/   # プロバイダー別プロンプトテンプレート + 変数プレースホルダー
│   ├── hive-quality-gates/     # G1-G3ゲート定義、マーカープロトコル、ハッシュチェーン、討論ルーブリック
│   └── hive-tdd-pipeline/      # G4-G7 TDDループ、エージェント分離、ミューテーション/PBT/E2E
├── dashboard/                  # リアルタイム可視化（Next.js + WebSocket）
│   ├── src/                    # Reactコンポーネント、Zustandストア、フック
│   └── server/                 # WebSocketイベントサーバー（chokidar + ws）
├── hooks/                      # Claude Codeフック統合
│   ├── hooks.json              # SessionStart + PostToolUseフック定義
│   └── scripts/                # setup-dashboard.sh, validate-skills.sh
├── scripts/                    # 検証とテスト
│   ├── validate-plugin.sh      # 54項目の構造検証
│   ├── validate-standards.sh   # 27項目の標準準拠検証
│   ├── validate-gates.sh       # マーカーチェーン + ハッシュ整合性検証
│   ├── validate-phase5-entry.sh# チームコンセンサスマーカー検証
│   ├── validate-all.sh         # 統合ランナー（全バリデーター）
│   ├── test_markers.py         # 20個のマーカーフォーマットパターンテスト
│   └── run-tests.sh            # テストスイート全体ランナー
├── systemd/                    # Auto-debugタイマー（定期検証）
├── .claude-plugin/plugin.json  # プラグインマニフェスト
├── marketplace.json            # プラグインマーケットプレイス登録
├── install-systemd.sh          # Systemd auto-debugインストーラー
└── uninstall-systemd.sh        # Systemd auto-debugアンインストーラー
```

### スキル

| スキル | 行数 | 役割 |
|--------|------|------|
| `hive` | 238 | エントリポイント — Phaseルーター、ハードゲート、プロバイダールール |
| `hive-workflow` | 500 | Phase 0-5エンジン — プロンプトEng、ブレスト、Serena、チーム、実行 |
| `hive-consensus` | 456 | Phase 4コンセンサスプロトコル — 双方向AGREE/COUNTER/CLARIFY |
| `hive-quality-gates` | 228 | G1-G3ゲート定義、マーカープロトコル、ハッシュチェーン、討論ルーブリック |
| `hive-spawn-templates` | 181 | プロバイダー別プロンプトテンプレート + 変数プレースホルダー |
| `hive-tdd-pipeline` | 175 | G4-G7 TDDループ、エージェント分離、ミューテーション/PBT/E2E検証 |

### フック

Hiveは`hooks/hooks.json`を通じてClaude Codeフックを登録します：

| イベント | ハンドラー | 役割 |
|----------|----------|------|
| `SessionStart` | `setup-dashboard.sh` | 初回使用時にダッシュボード依存関係を自動インストール |
| `PostToolUse` (Edit/Write) | `validate-skills.sh` | スキルファイル修正時に自動検証 |

### ランタイム状態

```
.hive-state/          (gitignore対象)
├── g1-clarify.marker
├── g2-spec.marker
├── g3-plan-review.marker
├── g4-tdd-red.marker
├── g5-implement.marker
├── g6-cross-verify.marker
└── g7-e2e-validate.marker
```

マーカーはファイルとして保存し、会話コンテキストの肥大化を防止。会話には `[G1 ✓] [G2 ✓] ...` の要約のみ表示。

---

## 要件

- **Claude Code CLI**（最新版）
- **Serena MCPサーバー** — Phase 2コードベース分析用
- **CCBブリッジ** — Codex/Gemini統合（オプションだが完全なマルチプロバイダーオーケストレーションに推奨）
- **Node.js** — リアルタイムダッシュボード用

## インストール

### プラグインマーケットプレイス

```bash
# マーケットプレイス追加
/plugin marketplace add inhyoe/hive-plugin

# インストール
/plugin install hive@hive-marketplace
```

### 手動インストール

インストールスクリプトはシンボリックリンクを作成するため、`git pull`だけでHiveを使用する全プロジェクトが自動更新されます。

```bash
# インストール（シンボリックリンク作成 — git pullで全プロジェクト自動更新）
bash install.sh

# 変更なしでプレビュー
bash install.sh --dry-run

# カスタムClaudeホームにインストール
bash install.sh --claude-home /path/to/.claude

# アンインストール
bash install.sh --uninstall
```

### Auto-Debugタイマー（オプション）

定期検証のためのsystemdタイマーを設定します：

```bash
# インストール
bash install-systemd.sh

# 設定
vim ~/.config/claude-auto-debug/config.env  # PROJECT_DIRを指定

# アンインストール
bash uninstall-systemd.sh
```

## 使い方

```bash
/hive "アプリにチャット機能を追加"
/hive "認証モジュールのリファクタリング"
/hive "リアルタイム通知の実装"
```

品質パイプラインは自動的に有効化されます：

1. **G1 CLARIFY** — スコープ質問に回答（多肢選択式、最大3ラウンド）
2. **G2 SPEC** — 6セクション仕様が生成され承認を要求
3. **Phase 0-3** — プロンプトエンジニアリング、ブレスト、コードベース分析、チーム分解
4. **G3 PLAN REVIEW** — DesignerとReviewerが計画を討論（スコア >= 7.0で通過）
5. **Phase 4** — 各チームがAGREE/COUNTER/CLARIFYでコンセンサス
6. **G4-G7** — TDDパイプライン：テスト先行（RED）、実装（GREEN）、交差検証、E2E検証

## 検証

```bash
# 全バリデーターを一括実行（計146項目チェック）
bash scripts/validate-all.sh

# 個別バリデーター
bash scripts/validate-plugin.sh       # 54項目の構造検証
bash scripts/validate-standards.sh    # 27項目の標準検証
bash scripts/validate-gates.sh        # マーカーチェーン + ハッシュ整合性
bash scripts/validate-phase5-entry.sh # チームコンセンサスマーカー
python3 scripts/test_markers.py       # 20個のマーカーフォーマット検証

# テストスイート全体
bash scripts/run-tests.sh
```

## 標準準拠

- [Agent Skills Open Standard](https://agentskills.io) — 完全準拠
- Claude Code Plugin Reference — 完全準拠
- 全146項目の検証通過

## ライセンス

MIT
