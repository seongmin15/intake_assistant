# 용어집

---

| 용어 | 정의 | 동의어 | 사용 예시 |
|------|------|--------|----------|
{% for glossa_i in glossary %}
| {{ glossa_i.term }} | {{ glossa_i.definition }} | {{ glossa_i.aliases }} | {{ glossa_i.example }} |
{% endfor %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지.
     새 용어는 기존 테이블 형식(용어|정의|동의어|사용 예시)으로 append.
     가나다/알파벳 순 유지. 사용자 승인 후 추가. -->
