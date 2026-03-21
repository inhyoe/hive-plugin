# Phase 2: Serena Context (코드베이스 분석)

Phase 1 요구사항의 **기능 범위**를 기반으로 Serena MCP를 단계적으로 호출합니다.

## 2-1. 프로젝트 구조 파악 (Top-Down)

```
Step A: 디렉토리 스캔
  mcp__serena-shared__list_dir(".", recursive=false)
  → 최상위 구조 파악 + 소스 루트 자동 식별

  감지된 소스 루트(예: lib/, src/, skills/, app/) 중 요구사항과 관련된 디렉토리:
  mcp__serena-shared__list_dir("<detected_source_root>", recursive=true)
  → 소스 코드 트리

Step B: 핵심 모듈 심볼 오버뷰
  요구사항 기능 범위에 해당하는 디렉토리들:
  mcp__serena-shared__get_symbols_overview(relative_path, depth=1)
  → 클래스/함수/변수 목록 수집
```

## 2-2. 작업 대상 코드 식별 (Targeted)

```
Step C: 키워드 기반 심볼 검색
  요구사항에서 핵심 키워드 추출:
  mcp__serena-shared__find_symbol(name_path_pattern, substring_matching=true)
  → 관련 클래스/메서드 식별

Step D: 패턴 검색 (보완)
  심볼 검색으로 부족하면:
  mcp__serena-shared__search_for_pattern(substring_pattern, restrict_search_to_code_files=true)
  → 문자열 리터럴, 설정값, 라우트 등 비심볼 탐색
```

## 2-3. 의존성 매핑

```
Step E: 참조 그래프
  식별된 핵심 심볼들:
  mcp__serena-shared__find_referencing_symbols(name_path, relative_path)
  → 누가 이 코드를 쓰는지, 변경 영향 범위

Step F: 영향 범위 맵 생성 (in-memory)
  {
    "modules": [
      {
        "name": "module_name",
        "files": ["lib/path/to/file.dart", ...],
        "symbols": ["ClassName", "methodName", ...],
        "dependencies": ["other_module", ...],
        "dependents": ["consuming_module", ...]
      }
    ]
  }
```

## 2-4. 자동 vs 수동 경계

| 상황 | 동작 |
|------|------|
| 영향 모듈 5개 이하 | 자동으로 Phase 3 진입 |
| 영향 모듈 6개 이상 | AskUserQuestion: "이 모듈들이 맞나요?" |
| Serena에서 심볼 못 찾음 | 사용자에게 힌트 요청 후 재검색 |

원칙:
- **최소 토큰**: `include_body=false`로 시작, 필요한 심볼만 `include_body=true`
- **Serena 우선**: Read로 전체 파일 읽기 대신 심볼 단위 탐색
- **영향 범위 맵이 Phase 3의 입력**
- **컨텍스트 예산**: 리드=요구사항+아키텍처, Claude=심볼+의존성, Codex=코드+타입만, Gemini=요약+패턴 (hive-spawn-templates §2)
