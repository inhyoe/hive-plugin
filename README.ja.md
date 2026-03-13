# Hive — マルチプロバイダー オーケストレーション チームビルダー

[English](README.md) | [한국어](README.ko.md) | **[日本語]**

> **v2.0.0** — 7段階品質パイプライン + ハードゲート強制

マルチプロバイダーAIチーム（Claude/Codex/Gemini）を構築・統率し、研究に基づいた品質パイプラインで**すべてのユーザーに同一の品質ゲートを強制**します。

```
[G1 CLARIFY] → [G2 SPEC] → プロンプトEng → ブレスト → Serena → チーム構成
→ [G3 PLAN REVIEW] → コンセンサス → [G4 TDD RED] → [G5 IMPLEMENT GREEN]
→ [G6 CROSS-VERIFY] → [G7 E2E VALIDATE] → 完了
```

---

## なぜ v2.0.0 なのか？

従来のAIコーディングワークフローには3つの根本的な問題があります：

1. **曖昧なリクエストは曖昧なコードを生む** — 要件が不明確なら結果も不明確
2. **テストは通るのにコードが動かない** — エージェントが自分の前提を検証するテストを書く
3. **責任の所在がない** — 単一エージェントのセルフレビューでは何も検出できない

Hive v2.0.0 はこれを解決します：

- **必須の明確化**（G1+G2）— 作業開始前にスコープ/基準/制約を必ず確認
- **エージェント分離** — テスト作成者は実装を見れず、実装者はテスト意図を見れない（CodeDelegatorパターン）
- **マルチエージェント交差検証** — ミューテーションテスト + プロパティベーステスト + クロスモデルレビュー
- **ハードゲート** — 各段階は前のマーカーが存在しなければ進入不可；バイパス不可

研究基盤：AgentSpec (ICSE 2026)、TGen TDD (2024)、Meta ACH (FSE 2025)、CodeDelegator (2025)、Du et al. マルチエージェント討論 (2023)、PGS PBT (FSE 2025)。

---

## 主要機能

### 品質パイプライン（7ハードゲート）

| ゲート | 名前 | 役割 | 強制 |
|--------|------|------|------|
| G1 | **CLARIFY** | スコープ/成功基準/制約の明確化、多肢選択式質問（最大3ラウンド） | G2進入前に必須 |
| G2 | **SPEC** | 6セクション自然言語仕様の作成、不変条件2個+、境界条件3個+、SHA256ハッシュ | Phase 0進入前に必須 |
| G3 | **PLAN REVIEW** | Designer↔Reviewer相互討論（一方向レビューではない）、5次元ルーブリック、スコア >= 7.0 | Phase 4/5進入前に必須 |
| G4 | **TDD RED** | SPEC基準テスト作成（3層：例示/プロパティ/スモーク）、全テストFAIL必須 | G5進入前に必須 |
| G5 | **IMPLEMENT GREEN** | 分離された実装者が全テストPASS（最大5回反復）、テスト改ざん検知 | G6進入前に必須 |
| G6 | **CROSS-VERIFY** | ミューテーションテスト（>= 60%）、PBT（100回+）、非関与エージェントによる交差レビュー | G7進入前に必須 |
| G7 | **E2E VALIDATE** | 実際の実行検証（スクリプト/統合/Hive特化）、モック禁止 | 完了宣言前に必須 |

各ゲートはマーカーを発行します（例：`[CLARIFY PASSED — scope:{...}]`）。次のゲートは前のマーカーの存在を確認します。**マーカーなし＝進行不可。**

### エージェント分離（CodeDelegatorパターン）

```
Agent A (Claude)         Agent B (Codex)         Agent C (Gemini)
- SPEC基準テスト作成     - 最小実装              - 検証（ミューテーション/PBT）
- SPECのみ参照          - テスト+コードベース参照 - 両方の結果のみ参照
  実装コードアクセス不可  テスト意図アクセス不可   プロセスアクセス不可
```

情報障壁によりContext Pollutionを防止（Kemple 2025、CP > 0.25で品質低下）。

### ハッシュチェーン改ざん防止

| 検証時点 | 対象 | 不一致時 |
|----------|------|---------|
| G3進入 | SPECハッシュ | Phase 0へ回帰 |
| G5進入 | テストファイルハッシュ | G4へ回帰 |
| G6進入 | 実装コードハッシュ | G5へ回帰 |

すべてのハッシュは `Bash("sha256sum ...")` で計算 — LLMはSHA256を直接計算できません。

### マルチプロバイダー配分

| 役割 | プロバイダー | 配分 |
|------|------------|------|
| コアロジック / アーキテクチャ | Claude (Agent) | 50-60% |
| 実装 / リファクタリング | Codex (cask) | 20-30% |
| リサーチ / テスト / ドキュメント | Gemini (gask) | 10-20% |

Codexは**必ず実装**しなければなりません（レビューのみ不可）。Geminiは**必ず参加**しなければなりません。Claude独占禁止。

### AGENT_CAPABILITY_DIRECTIVE

すべての外部エージェント（レビュアー、ワーカー、検証者、調停者）スポーン時に必須の指示：

```xml
<AGENT_CAPABILITY_DIRECTIVE>
You MUST utilize ALL available resources before and during your task:
- Invoke all relevant skills (code analysis, review, testing, patterns)
- Use all connected MCP tools (file ops, AST analysis, code search, web fetch)
- If uncertain about API/library usage, use web search to verify
- Do NOT guess APIs or syntax — look them up first
Do NOT respond or write code based on inference alone when tools are available.
</AGENT_CAPABILITY_DIRECTIVE>
```

---

## アーキテクチャ

### スキル（全6個）

| スキル | 行数 | 役割 |
|--------|------|------|
| `hive` | 161 | エントリポイント — Phaseルーター、ハードゲート、プロバイダールール |
| `hive-workflow` | 499 | Phase 0-5エンジン — プロンプトエンジニアリング、ブレスト、Serena、チーム、実行 |
| `hive-consensus` | 482 | Phase 4コンセンサスプロトコル — 双方向AGREE/COUNTER/CLARIFY |
| `hive-spawn-templates` | 174 | プロバイダー別プロンプトテンプレート + 変数プレースホルダー |
| `hive-quality-gates` | 210 | G1-G3ゲート定義、マーカープロトコル、ハッシュチェーン、討論ルーブリック |
| `hive-tdd-pipeline` | 173 | G4-G7 TDDループ、エージェント分離、ミューテーション/PBT/E2E検証 |

### スクリプト

| スクリプト | 役割 |
|-----------|------|
| `validate-plugin.sh` | 54項目の構造検証 |
| `validate-standards.sh` | 27項目の標準準拠検証 |
| `validate-gates.sh` | マーカーチェーン + ハッシュ整合性検証 |
| `test_markers.py` | 20個のマーカーフォーマットパターン検証 |
| `run-tests.sh` | 統合テストスイートランナー（4カテゴリ） |

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

- Claude Code CLI
- Serena MCPサーバー（コードベース分析用）
- CCBブリッジ（Codex/Gemini統合、オプションだが推奨）

## インストール

### プラグインとして

```bash
# マーケットプレイス追加
/plugin marketplace add YOUR_GITHUB_USERNAME/hive-plugin

# インストール
/plugin install hive@YOUR_MARKETPLACE_NAME
```

### 手動インストール

```bash
cp -r skills/hive ~/.claude/skills/
cp -r skills/hive-consensus ~/.claude/skills/
cp -r skills/hive-workflow ~/.claude/skills/
cp -r skills/hive-spawn-templates ~/.claude/skills/
cp -r skills/hive-quality-gates ~/.claude/skills/
cp -r skills/hive-tdd-pipeline ~/.claude/skills/
```

## 使い方

```
/hive "アプリにチャット機能を追加"
/hive "認証モジュールのリファクタリング"
/hive "リアルタイム通知の実装"
```

品質パイプラインは自動的に有効化されます。明確化質問（G1）、SPEC承認要求（G2）、計画討論（G3）を経て、実装前にテストが先に作成されます（G4-G7）。

## パイプラインフロー

```
/hive "ユーザーリクエスト"
  │
  ├─ G1: CLARIFY（スコープ/基準/制約の明確化）
  ├─ G2: SPEC（6セクション仕様 + SHA256ハッシュ）
  │
  ├─ Phase 0: プロンプトエンジニアリング & リソース探索
  ├─ Phase 1: ブレインストーム（要件明確化）
  ├─ Phase 2: Serenaコンテキスト（コードベース分析）
  ├─ Phase 3: チーム分解（モジュール基準分割）
  │
  ├─ G3: PLAN REVIEW（Designer↔Reviewer相互討論、スコア >= 7.0）
  ├─ Phase 4: コンセンサスループ（チーム別双方向合意）
  │
  ├─ G4: TDD RED（SPEC基準テスト、全テストFAIL）
  ├─ G5: IMPLEMENT GREEN（分離された実装者、全テストPASS）
  ├─ G6: CROSS-VERIFY（ミューテーション >= 60%、PBT、クロスモデルレビュー）
  ├─ G7: E2E VALIDATE（実際の実行、モック禁止）
  │
  └─ 完了（7ゲートすべて通過）
```

## コンセンサスプロトコル

すべてのエージェントは担当モジュールについて実装前にCONSENSUSに到達しなければなりません：

- **AGREE**: 提案されたアプローチを受入
- **COUNTER**: 代替案とともに技術的問題を提起（技術的問題発見時は義務）
- **CLARIFY**: 追加情報を要求

エージェントあたり最大5ラウンド。膠着時はGeminiが調停（2/3多数決）。3ラウンド後の合意失敗時はリードが最終決定。

## 検証

```bash
# 全テスト実行（構造 + マーカー + CCB + ゲート）
bash scripts/run-tests.sh

# 個別バリデーター
bash scripts/validate-plugin.sh      # 54項目の構造検証
bash scripts/validate-standards.sh   # 27項目の標準検証
bash scripts/validate-gates.sh       # マーカーチェーン + ハッシュ整合性
python3 scripts/test_markers.py      # 20個のマーカーフォーマット検証
```

## ライセンス

MIT
