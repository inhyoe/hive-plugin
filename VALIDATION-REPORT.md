# Hive Plugin Validation Report

> **Version**: 1.5.0 | **Date**: 2026-03-07 | **Iterations**: 10회 반복 검증 완료

---

## 1. 검증 기준 (Sources of Truth)

본 검증은 아래 공식 문서 및 커뮤니티 리소스를 기준으로 수행되었습니다.

| # | 출처 | URL | 용도 |
|---|------|-----|------|
| S1 | Claude Code Skills 공식 문서 | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) | SKILL.md 구조, frontmatter 필드, 변수 치환 |
| S2 | Skill Authoring Best Practices | [platform.claude.com/.../best-practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | description 작성법, 안티패턴, 체크리스트 |
| S3 | Agent Skills Open Standard | [agentskills.io/specification](https://agentskills.io/specification) | 크로스 플랫폼 표준 스펙 (name/description 제약) |
| S4 | Plugins Reference | [code.claude.com/docs/en/plugins-reference](https://code.claude.com/docs/en/plugins-reference) | plugin.json 스키마, 디렉토리 구조 |
| S5 | Deep Dive 분석 | [leehanchung.github.io/.../claude-skills-deep-dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) | 내부 동작, 안티패턴, 엣지 케이스 |
| S6 | Frontmatter Bug #9817 | [github.com/anthropics/claude-code/issues/9817](https://github.com/anthropics/claude-code/issues/9817) | description 멀티라인 파싱 실패 이슈 |
| S7 | Anthropic Skills Repo | [github.com/anthropics/skills](https://github.com/anthropics/skills) | 공식 스킬 예제, skill-creator 참조 구현 |

---

## 2. 검증 대상 파일

```
hive-plugin/
├── .claude-plugin/
│   └── plugin.json                          # 플러그인 매니페스트
├── skills/
│   ├── hive/SKILL.md                        # 메인 엔트리 포인트 (user-invocable)
│   ├── hive-workflow/SKILL.md               # Phase 1-3, 5 워크플로우 엔진
│   ├── hive-consensus/SKILL.md              # Phase 4 합의 프로토콜
│   └── hive-spawn-templates/
│       ├── SKILL.md                         # 템플릿 인덱스
│       └── templates/
│           ├── claude-agent.md              # Claude Agent 스폰 템플릿
│           ├── codex-agent.md               # Codex Agent 스폰 템플릿
│           └── gemini-agent.md              # Gemini Agent 스폰 템플릿
├── scripts/
│   ├── validate-plugin.sh                   # 구조 검증 스크립트 (Bash)
│   └── test_markers.py                      # 마커 포맷 검증 스크립트 (Python)
└── README.md
```

---

## 3. 테스트 방법론 (How We Tested)

### 3-A. 자동화 테스트 스크립트

#### `scripts/validate-plugin.sh` — 플러그인 구조 검증 (38 checks)

**실행 방법:**
```bash
bash scripts/validate-plugin.sh
```

**검증 항목 및 검증 로직:**

| Check | 무엇을 검증하는가 | 어떻게 검증하는가 |
|-------|-------------------|-------------------|
| **Check 1: Directory Structure** | `skills/*/` 하위에 SKILL.md가 존재하는지 | `skills/` 디렉토리를 순회하며 각 하위 디렉토리에서 `SKILL.md` 파일 존재 여부를 `[[ -f "$dir/SKILL.md" ]]`로 확인. `commands/` 디렉토리가 없으면 PASS (레거시 마이그레이션 완료) |
| **Check 2: SKILL.md Frontmatter** | `name`, `description`, `user-invocable` 필드 존재 및 비어있지 않은지 | 커스텀 Bash 파서(`get_frontmatter_field`)가 `---` 사이의 YAML frontmatter를 줄 단위로 파싱. `^${field}:(.*)$` 정규식으로 필드명 매칭 후 값 추출. `user-invocable`은 absent일 때 PASS (spec상 기본값 true) |
| **Check 3: commands/*.md Frontmatter** | 레거시 commands의 `name`, `description`, `allowed-tools` | 동일 파서로 각 필드 존재 + 비어있지 않음 확인. commands/ 디렉토리 없으면 skip |
| **Check 4: Line Count Limits** | SKILL.md ≤ 500줄, templates ≤ 200줄 | `wc -l < "$file"`로 줄 수 계산 후 임계값 비교. `find "$REPO_ROOT/skills" -path "*/templates/*.md" -print0`으로 템플릿 파일 재귀 탐색 |
| **Check 5: Supporting File References** | SKILL.md 내 Markdown 링크의 대상 파일 존재 여부 | `grep -oP '\[(?:[^\]]*)\]\(\K[^)]+(?=\))'`로 `[text](path)` 형식의 링크 경로 추출. URL(`^https?://`)과 앵커(`^#`)를 필터링. `realpath -m`으로 상대 경로를 절대 경로로 해석 후 `[[ -e "$resolved_path" ]]` 확인 |
| **Check 6: Frontmatter Value Validation** | `name`이 디렉토리명과 일치, `user-invocable`이 boolean | 문자열 비교(`name_val == dir_name`)와 값 검증(`ui_val == "true" \|\| ui_val == "false"`) |

#### `scripts/test_markers.py` — 프로토콜 마커 포맷 검증 (15 checks)

**실행 방법:**
```bash
python3 scripts/test_markers.py
```

**검증 항목 및 검증 로직:**

| 요소 | 무엇을 검증하는가 | 어떻게 검증하는가 |
|------|-------------------|-------------------|
| **마커 탐지** | `[`로 시작하는 줄에서 프로토콜 마커 후보 식별 | `MARKER_START_RE = r"^\[(TASK PROPOSAL\|FOLLOW-UP\|HIVE IMPLEMENTATION\|AGREE\|COUNTER\|CLARIFY)(?:\s+—\|\])"` 정규식으로 6종 마커명 캡처 |
| **템플릿 형식** | `{{TEAM_ID}}`, `{팀 ID}` 등 플레이스홀더 포함 마커 | `PLACEHOLDER = r"(?:\{\{[A-Z0-9_]+\}\}\|\{[^{}]+\})"` 패턴으로 두 가지 변수 스타일 허용. 라운드/웨이브 변수는 `R{{VAR}}`, `W{{VAR}}` 접두사 포함 패턴 |
| **인스턴스 형식** | `T1`, `R1`, `W1` 등 실제 값 포함 마커 | `r"^\[TASK PROPOSAL — T\d+ — R\d+\]\s*$"` 식의 구체 패턴 매칭 |
| **대상 파일** | 5개 파일의 모든 마커가 정규 형식에 일치 | `TARGET_FILES` 리스트를 순회하며 각 줄의 마커를 `template` 또는 `instance` 패턴과 매칭. 어느 쪽에도 안 맞으면 FAIL |

**검증 대상 6종 마커:**

| 마커 | 정규 형식 (template) | 정규 형식 (instance) |
|------|---------------------|---------------------|
| `TASK PROPOSAL` | `[TASK PROPOSAL — {var} — R{var}]` | `[TASK PROPOSAL — T1 — R1]` |
| `FOLLOW-UP` | `[FOLLOW-UP — {var} — R{var} — parent:R{var}]` | `[FOLLOW-UP — T1 — R2 — parent:R1]` |
| `HIVE IMPLEMENTATION` | `[HIVE IMPLEMENTATION — {var} — W{var}]` | `[HIVE IMPLEMENTATION — T1 — W1]` |
| `AGREE` | `[AGREE — {var}]` | `[AGREE — T1]` |
| `COUNTER` | `[COUNTER — {var}]` | `[COUNTER — T1]` |
| `CLARIFY` | `[CLARIFY — {var}]` | `[CLARIFY — T1]` |

### 3-B. 수동 종합 감사 (52 checks, Python)

**실행 방법:**
```python
# Iteration 10에서 실행한 종합 감사 스크립트 (인라인)
python3 << 'PYEOF'
import yaml, json, re, os
# ... (52항목 검증)
PYEOF
```

**검증 항목 및 검증 로직:**

| 카테고리 | 검증 항목 | 검증 방법 |
|----------|----------|----------|
| **plugin.json** | 유효한 JSON, `name`/`version`/`description` 필수 필드 | `json.load()`로 파싱 후 각 키 존재 + 비어있지 않음 확인 |
| **name 필드** | 디렉토리명 일치, ≤64자, kebab-case | `re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', name)` |
| **description 필드** | 비어있지 않음, ≤1024자, XML 태그 없음, 3인칭 | `len(desc) <= 1024`, `not ("<" in desc and ">" in desc)`, `not desc.startswith("You ")` |
| **user-invocable** | boolean 타입 또는 absent | `isinstance(ui, bool)` (PyYAML이 `true`/`false`를 Python bool로 파싱) |
| **argument-hint** | string 타입 (YAML list 아님) | `isinstance(ah, str)` — `[value]` 형식이 YAML list로 파싱되는 함정 탐지 |
| **줄 수 제한** | SKILL.md ≤500, templates ≤200 | `len(lines)` 비교 |
| **버전 일관성** | plugin.json과 SKILL.md의 버전 동일 | 두 파일에서 `\d+\.\d+\.\d+` 패턴 추출 후 set 비교 |
| **파일 참조** | Markdown 링크 대상 파일 존재 | `re.findall(r'\[(?:[^\]]*)\]\(([^)]+)\)', content)`로 추출 후 `os.path.exists()` |

### 3-C. 수동 심층 분석 (Iteration 4-9)

| Iteration | 분석 관점 | 검증 방법 |
|-----------|----------|----------|
| **4: 의미론적 일관성** | `TeamCreate`/`TeamDelete`/`SendMessage` 사용 패턴, Agent tool 파라미터 정확성 | `Grep` 도구로 전 파일 대상 패턴 검색, 공식 Agent tool 파라미터(`description`, `prompt`, `subagent_type`, `isolation`, `resume`, `run_in_background`)와 비교 |
| **5: Frontmatter 심층** | YAML 파싱 정확성, description 트리거 구문 | Python `yaml.safe_load()`로 각 frontmatter를 실제 파싱, 타입/길이/내용 검사 |
| **6: 교차 참조** | 스킬 간 참조 정확성, 섹션 번호 일치 | `Grep`으로 `hive-workflow`, `hive-consensus`, `hive-spawn-templates` 참조 추출, 실제 파일/섹션 존재 확인. `LEAD DECISION`/`HIVE PROGRESS` 마커 사용 일관성 |
| **7: 보안** | 민감 정보, Shell injection, 위험 파일 | `password\|secret\|token\|api.?key` 패턴 검색, `eval\|exec\|subprocess` 패턴 검색, `\$\(\|backtick` 패턴 검색, `.env*`/`*.key` glob 탐색 |
| **8: README/plugin.json** | 버전 일관성, 설치 경로 정확성 | plugin.json version vs SKILL.md version 비교, README 내 `skills/*` 경로와 실제 디렉토리 매칭 |
| **9: 인코딩/포맷** | UTF-8 인코딩, LF 줄바꿈, 후행 개행 | `file` 명령으로 인코딩 확인, `grep -rPl '\r\n'`으로 CRLF 탐지, `tail -c 1`로 후행 개행 확인 |

---

## 4. 반복 검증 결과 요약

| Iteration | 관점 | 발견/수정 | 결과 |
|-----------|------|-----------|------|
| 1 | 초기 구조 마이그레이션 | P0: plugin.json 생성, commands/→skills/ 마이그레이션. P1: description 영문 3인칭, Agent tool 파라미터 수정. P2: 마커 불일치 수정. P3: 테스트 스크립트 경로 업데이트 | PASS |
| 2 | 마커/참조 정확성 | `[HIVE CONSENSUS REQUEST]`→`[TASK PROPOSAL]` 수정 (codex/gemini 템플릿). `team_name` 비공식 파라미터 제거 (hive-workflow) | 38+15 PASS |
| 3 | description 정확도 | hive-workflow: "Phase 1-5"→"Phase 1-3, 5" (Phase 4는 hive-consensus 담당) | 38+15 PASS |
| 4 | 의미론적 일관성 | 프로바이더 대칭성, SendMessage/TeamCreate 허용성 분석. 추가 이슈 없음 | 38+15 PASS |
| 5 | Frontmatter 심층 | `argument-hint: [task-description]` YAML list→string 수정. hive-spawn-templates description에 "when" 트리거 추가 | 38+15 PASS |
| 6 | 교차 참조 일관성 | 스킬 간 참조, 섹션 번호, LEAD DECISION/HIVE PROGRESS 마커 사용 확인. 이슈 없음 | 38+15 PASS |
| 7 | 보안 분석 | 민감 정보, Shell injection, .env 파일. 이슈 없음 | 38+15 PASS |
| 8 | README/plugin.json | 버전 일관성 (1.5.0), 설치 경로 4/4 정확. 이슈 없음 | 38+15 PASS |
| 9 | 인코딩/포맷 | UTF-8, LF, 후행 개행 전부 정상. 이슈 없음 | 38+15 PASS |
| 10 | 종합 감사 | 52항목 + 38항목 + 15항목 = **105/105 PASS** | ALL PASS |

---

## 5. 공식 표준 기반 Best Practices

> 아래 내용은 [S1]-[S7] 공식 문서에서 추출한 권장 사항이며, hive-plugin의 준수 여부를 함께 기록합니다.

### 5-1. SKILL.md Frontmatter

| 규칙 | 근거 | hive-plugin 준수 |
|------|------|-----------------|
| `name`: lowercase, hyphens, numbers만 허용. 최대 64자 | S3: agentskills.io spec | **PASS** — `hive`, `hive-workflow`, `hive-consensus`, `hive-spawn-templates` 모두 kebab-case |
| `name`: 디렉토리명과 일치해야 함 | S3: "Must match the parent directory name" | **PASS** — 4/4 일치 |
| `name`: 하이픈으로 시작/끝 불가, 연속 하이픈 불가 | S3: name constraints | **PASS** |
| `description`: 비어있으면 안 됨, 최대 1024자 | S3: "Must be 1-1024 characters" | **PASS** — 169~298자 범위 |
| `description`: XML 태그 포함 금지 | S2: "Cannot contain XML tags" | **PASS** — 4/4 XML-free |
| `description`: 3인칭으로 작성 | S2: "Always write in third person" | **PASS** — 모두 "Orchestrates...", "Core workflow...", "Bidirectional..." 등 |
| `description`: "Use when" 트리거 포함 권장 | S2: "Include both what the Skill does and when to use it" | **PASS** — 4/4 포함 |
| `description`: 한 줄로 작성 (멀티라인 파싱 버그) | S6: GitHub #9817 — prettier 포맷팅 시 discovery 실패 | **PASS** — 모두 single-line |
| `argument-hint`: 문자열 타입이어야 함 | S1: frontmatter reference | **PASS** — `"[task-description]"` (따옴표로 YAML list 방지) |
| `user-invocable`: boolean 또는 absent | S1: "Set to false to hide from the / menu" | **PASS** — sub-skills는 `false`, main은 absent(=true) |
| `allowed-tools`: 스킬이 실제로 필요한 도구만 | S2: "Constrain side effects" | **NOTED** — main skill에 포괄적 목록 사용 (의도적) |
| SKILL.md body ≤ 500줄 | S2: "Keep SKILL.md body under 500 lines" | **PASS** — 최대 448줄 (hive-consensus) |

### 5-2. Plugin Manifest (plugin.json)

| 규칙 | 근거 | hive-plugin 준수 |
|------|------|-----------------|
| `name` 필수 (kebab-case) | S4: "name is the only required field" | **PASS** — `"hive"` |
| `.claude-plugin/plugin.json` 위치 | S4: "Only plugin.json goes inside .claude-plugin/" | **PASS** |
| skills/ 디렉토리는 플러그인 루트에 위치 | S4: "All other directories must be at the plugin root" | **PASS** |
| SemVer 버전 형식 | S4: "Follow semantic versioning" | **PASS** — `"1.5.0"` |
| 매니페스트와 스킬 간 버전 일치 | 일관성 원칙 | **PASS** — 양쪽 모두 1.5.0 |

### 5-3. Content Structure

| 규칙 | 근거 | hive-plugin 준수 |
|------|------|-----------------|
| Progressive disclosure: SKILL.md는 개요, 상세는 별도 파일 | S2: "SKILL.md serves as an overview" | **PASS** — hive-spawn-templates가 templates/ 하위 파일로 분리 |
| 파일 참조는 1단계 깊이까지만 | S2: "Keep references one level deep from SKILL.md" | **PASS** — SKILL.md → templates/*.md (1단계) |
| forward slash 경로만 사용 | S2: "Always use forward slashes" | **PASS** |
| `$ARGUMENTS`는 user-invocable 스킬에서만 | S1: variable substitution | **PASS** — hive/SKILL.md에서만 사용 |
| `${CLAUDE_SKILL_DIR}` 사용 시 스크립트/리소스 참조 | S1: "Use this to reference scripts" | **N/A** — 이 플러그인은 스크립트 실행 불필요 |

### 5-4. Conciseness (간결성 원칙)

| 규칙 | 근거 | hive-plugin 준수 |
|------|------|-----------------|
| Claude가 이미 아는 것은 설명하지 말 것 | S2: "Only add context Claude doesn't already have" | **PASS** — 프로토콜 고유 규칙만 기술 |
| 비 user-invocable 스킬은 context budget 점유 | S5: "Metadata pre-loaded at startup" | **GOOD** — 3개 sub-skill이 `user-invocable: false`로 Claude의 자동 발견 대상에서 제외 |
| 코드 블록은 필요한 부분만 | S2: "Concise is key" | **PASS** — 코드 블록은 워크플로우 의사코드 수준 |

---

## 6. 안티패턴 검사 결과

> 아래는 공식 문서 + 커뮤니티 deep dive에서 수집한 안티패턴 목록이며, hive-plugin 대비 검사 결과입니다.

### 6-1. 공식 안티패턴 (S2: Best Practices)

| 안티패턴 | 설명 | hive-plugin 해당 여부 |
|----------|------|----------------------|
| **Windows-style paths** | `scripts\helper.py` 같은 백슬래시 경로 | **해당 없음** — 모든 경로가 forward slash |
| **Too many options** | "pypdf, pdfplumber, PyMuPDF 중 선택" 식의 다수 옵션 제시 | **해당 없음** — 각 프로바이더별 단일 방식 제시 (Claude=Agent, Codex=/ask, Gemini=/ask) |
| **Deeply nested references** | SKILL.md→A.md→B.md→C.md 3단계+ 참조 | **해당 없음** — 최대 1단계 (SKILL.md→templates/*.md) |
| **Time-sensitive information** | "2025년 8월 전에는 구 API 사용" 같은 시간 종속 정보 | **해당 없음** |
| **Inconsistent terminology** | 같은 개념에 다른 용어 혼용 | **해당 없음** — "CONSENSUS", "COUNTER", "CLARIFY" 등 일관된 용어 사용 |
| **Over-abstraction** | 모든 마이크로 패턴마다 별도 스킬 | **해당 없음** — 4개 스킬이 명확한 책임 분리 (main, workflow, consensus, templates) |
| **Vague descriptions** | "Helps with documents" 수준의 모호한 설명 | **해당 없음** — 모든 description이 구체적 기능 + "Use when" 트리거 포함 |

### 6-2. 커뮤니티 발견 안티패턴 (S5: Deep Dive, S6: GitHub Issues)

| 안티패턴 | 설명 | hive-plugin 해당 여부 |
|----------|------|----------------------|
| **Multiline description** | Prettier가 description을 멀티라인으로 래핑하면 skill discovery 실패 (silent) | **해당 없음** — 모든 description이 single-line |
| **Context fork without task** | `context: fork` 설정했지만 실행 가능한 태스크 없는 스킬 | **해당 없음** — `context` 필드 미사용 |
| **Bloated SKILL.md** | 800줄+ 인라인 문서 | **해당 없음** — 최대 448줄 |
| **Overpermissive tool access** | 필요 이상의 도구 권한 | **주의** — main skill의 `allowed-tools`가 17개로 다소 넓지만, 오케스트레이션 특성상 의도적 |
| **Hardcoded absolute paths** | `/home/user/project/...` | **해당 없음** — 절대 경로 미사용 |
| **Undocumented `when_to_use` field** | 비공식 frontmatter 필드 사용 | **해당 없음** — 공식 필드만 사용 |
| **Assuming tools are installed** | 패키지 설치 가정 | **해당 없음** — 이 플러그인은 외부 패키지 불필요 |
| **Concurrent skill invocation** | 여러 스킬 동시 실행 (context 공유 문제) | **해당 없음** — 메인 스킬이 순차적으로 sub-skill 호출 |

### 6-3. 프로젝트 고유 주의사항

| 항목 | 상태 | 설명 |
|------|------|------|
| `TeamCreate`/`TeamDelete` in allowed-tools | **주의** | 표준 Claude Code 도구 목록에 없음. body에서 워크플로우 개념으로 사용. 비존재 도구를 allowed-tools에 포함해도 기능적 오류는 없음 (무시됨) |
| `SendMessage` in allowed-tools | **허용** | Agent 서브에이전트 간 통신 도구로, 에이전트 컨텍스트에서 사용 가능 |
| `{{VAR}}` custom placeholder | **문서화됨** | hive-spawn-templates/SKILL.md에 공식 변수(`$ARGUMENTS`, `${CLAUDE_SKILL_DIR}`)와의 차이 명시 |
| Korean body content | **허용** | frontmatter description은 영문 3인칭, body는 한국어. description이 Claude의 스킬 선택 기준이므로 영문이 올바른 선택 |

---

## 7. Best Practice 체크리스트 (S2 기반)

> [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) 문서 말미의 공식 체크리스트 대비 점검 결과.

### Core Quality

- [x] Description이 구체적이고 핵심 키워드 포함
- [x] Description이 스킬 기능 + 사용 시점 모두 기술
- [x] SKILL.md body가 500줄 이하
- [x] 상세 내용은 별도 파일로 분리 (templates/)
- [x] 시간 종속 정보 없음
- [x] 일관된 용어 사용
- [x] 구체적 예시 포함 (codex-agent.md의 실제 위임 예시)
- [x] 파일 참조가 1단계 깊이
- [x] Progressive disclosure 패턴 적용
- [x] 워크플로우에 명확한 단계 있음 (Phase 1-5)

### Agent Skills Open Standard (S3) Compliance

- [x] `name` 필드: 1-64자, lowercase+hyphens, 디렉토리명 일치
- [x] `description` 필드: 1-1024자, non-empty
- [x] SKILL.md가 스킬 디렉토리의 루트에 위치
- [x] 선택적 디렉토리 구조 (templates/) 사용

### Plugin Structure (S4) Compliance

- [x] `.claude-plugin/plugin.json` 올바른 위치
- [x] `skills/` 디렉토리가 플러그인 루트에 위치
- [x] 매니페스트의 `name` 필드 존재
- [x] SemVer 버전 형식

### Security

- [x] 비밀번호/토큰/API 키 미포함
- [x] Shell injection 패턴 없음
- [x] `.env` 파일 없음
- [x] Windows-style 경로 없음

### Encoding & Format

- [x] UTF-8 인코딩
- [x] LF 줄바꿈 (CRLF 없음)
- [x] 후행 개행 문자 있음

---

## 8. 개선 권장사항 (Non-blocking)

아래는 현재 표준을 위반하지는 않지만, 향후 개선 시 고려할 사항입니다.

| # | 항목 | 현재 상태 | 권장 |
|---|------|----------|------|
| 1 | `allowed-tools` 범위 | 17개 도구 나열 | 오케스트레이션에 필수적이나, `TeamCreate`/`TeamDelete` 제거 고려 |
| 2 | `user-invocable` 명시성 | main skill은 absent (기본값 true) | 명시적으로 `user-invocable: true` 추가하면 의도가 더 명확 |
| 3 | `LEAD DECISION` 마커 테스트 | test_markers.py에서 미검증 | 6종 마커 + LEAD DECISION + HIVE PROGRESS = 8종으로 테스트 확장 |
| 4 | `context` 필드 활용 | 미사용 | sub-skill을 `context: fork`로 분리 실행하면 context window 절약 가능 |
| 5 | `compatibility` 필드 | 미사용 | S3 spec의 선택 필드. "Requires Serena MCP, CCB bridge (optional)" 추가 고려 |
| 6 | 평가(Evaluation) 작성 | 없음 | S2: "Create evaluations BEFORE writing extensive documentation" — 3개+ 테스트 시나리오 권장 |

---

## 9. 참고: 스킬 내부 동작 원리

> S5 (Deep Dive) 기반. 스킬이 어떻게 발견/로딩/실행되는지 이해하면 더 나은 스킬을 작성할 수 있습니다.

### 스킬 선택 메커니즘

- **알고리즘 라우팅 없음**: 임베딩, 분류기, 정규식 매칭 없이 **순수 LLM 추론**으로 스킬 선택
- 모든 스킬의 `name`+`description`이 Skill tool description에 삽입됨 (기본 15,000자 budget)
- Claude의 transformer가 추론 시 매칭 수행

### 로딩 순서

1. **시작 시**: 모든 스킬의 metadata(name, description)만 시스템 프롬프트에 로드 (~100 토큰/스킬)
2. **트리거 시**: SKILL.md 전체 내용 로드 (<5000 토큰 권장)
3. **필요 시**: 참조 파일(templates/, references/) on-demand 로드

### Two-Message Injection

스킬 실행 시 두 개의 메시지가 대화에 주입됩니다:
1. **사용자에게 보이는 메시지**: `<command-message>The "hive" skill is loading</command-message>`
2. **숨겨진 메시지** (`isMeta: true`): 전체 스킬 프롬프트 (사용자 UI에 표시되지 않음)

### 실행 컨텍스트

- 스킬은 코드를 실행하는 것이 아니라 **Claude의 컨텍스트를 수정**하는 것
- `allowed-tools`는 스킬 실행 동안만 적용, 완료 후 원래 컨텍스트로 복귀
- `model` override도 스킬 실행 동안만 적용

---

Sources:
- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Skill authoring best practices — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills Open Standard Specification](https://agentskills.io/specification)
- [Plugins reference — Claude Code Docs](https://code.claude.com/docs/en/plugins-reference)
- [Claude Agent Skills: A First Principles Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Frontmatter formatting sensitivity bug — GitHub #9817](https://github.com/anthropics/claude-code/issues/9817)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
- [Equipping agents for the real world with Agent Skills — Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
