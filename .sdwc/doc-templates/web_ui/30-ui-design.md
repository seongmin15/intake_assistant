# UI 설계

---

## 1. 기술 스택

- **언어**: {{ language }}
- **프레임워크**: {{ framework }}
- **빌드 도구**: {{ build_tool }}
{% if rendering_strategy %}
- **렌더링**: {{ rendering_strategy }}{{ " (" ~ rendering_rationale ~ ")" if rendering_rationale else "" }}
{% endif %}
{% if css_strategy %}
- **CSS**: {{ css_strategy }}
{% endif %}
{% if state_management %}
- **상태 관리**: {{ state_management }}
{% endif %}

---

## 2. 페이지 흐름

{{ mermaid_page_flow }}

---

## 3. 페이지 상세

{% for page in pages %}
### {{ page.name }}

> {{ page.purpose }}

{% if page.key_interactions %}
**주요 인터랙션:**

{% for key_in_i in page.key_interactions %}
- {{ key_in_i }}
{% endfor %}
{% endif %}

{% if page.connected_endpoints %}
**연동 API:**

{% for connec_i in page.connected_endpoints %}
- {{ connec_i }}
{% endfor %}
{% endif %}

{% if page.states %}
**UI 상태:**

{% for state_i in page.states %}
- {{ state_i }}
{% endfor %}
{% endif %}

{% if page.components %}
**컴포넌트:**

| 컴포넌트 | 역할 |
|---------|------|
{% for comp in page.components %}
| {{ comp.name }} | {{ comp.purpose }} |
{% endfor %}
{% endif %}

---

{% endfor %}

## 4. 횡단 관심사

{% if accessibility_level %}
- **접근성**: {{ accessibility_level }}
{% endif %}
{% if i18n_required %}
- **국제화**: {{ i18n_required }}
{% endif %}
{% if supported_languages %}
- **지원 언어**: {{ supported_languages }}
{% endif %}
{% if responsive_strategy %}
- **반응형**: {{ responsive_strategy }}
{% endif %}
{% if browser_support %}
- **브라우저 지원**: {{ browser_support }}
{% endif %}
{% if offline_support %}
- **오프라인**: {{ offline_support }}
{% endif %}
{% if seo_requirements %}
- **SEO**: {{ seo_requirements }}
{% endif %}

{% if design_references %}
### 디자인 참조

{% for design_i in design_references %}
- {{ design_i }}
{% endfor %}
{% endif %}

<!-- Claude: 수정/추가 시 기존 섹션 구조와 형식을 유지.
     페이지 추가 시 §2 페이지 흐름(mermaid)도 함께 갱신. -->
