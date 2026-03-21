## Review Prompt Template

```
[REVIEW REQUEST]
아래 코드 변경사항을 리뷰해주세요.

HIGH SIGNAL 이슈만 보고하세요:
- 컴파일/파싱 실패 (구문 오류, 타입 오류, missing imports)
- 확실한 로직 오류 (입력과 무관하게 잘못된 결과)
- 보안 취약점
- CLAUDE.md 규칙 위반 (정확한 규칙 인용)

보고하지 마세요:
- 코드 스타일, 품질 우려
- 특정 입력에만 발생하는 잠재적 이슈
- 주관적 개선 제안
- linter가 잡을 수 있는 것

출력 형식:
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND

--- DIFF START ---
{diff}
--- DIFF END ---
```

## Verify Prompt Template

```
[VERIFY REQUEST]
이전 리뷰에서 지적된 이슈들이 수정되었습니다.
수정된 부분만 검증해주세요. 새로운 이슈도 확인해주세요.

이전 지적사항:
{previous_issues}

수정 diff:
--- FIX DIFF START ---
{fix_diff}
--- FIX DIFF END ---

출력 형식:
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND
```
