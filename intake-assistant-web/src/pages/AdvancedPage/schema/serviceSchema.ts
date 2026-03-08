import type { FieldDef } from "./fieldTypes";

export const SERVICE_TYPES = [
  { value: "backend_api", label: "Backend API" },
  { value: "web_ui", label: "Web UI" },
  { value: "worker", label: "Worker" },
  { value: "mobile_app", label: "Mobile App" },
  { value: "data_pipeline", label: "Data Pipeline" },
] as const;

/** Common fields shared by all service types */
const commonFields: FieldDef[] = [
  { path: "name", label: "서비스 이름", type: "text", required: true, placeholder: "예: my-backend-api" },
  { path: "responsibility", label: "책임", type: "textarea", required: true, placeholder: "이 서비스의 역할" },
  {
    path: "communication_with", label: "통신 대상", type: "array", required: false,
    arrayItemFields: [
      { path: "target", label: "대상 서비스", type: "text", required: true },
      { path: "protocol", label: "프로토콜", type: "enum", required: true, enumValues: ["http", "grpc", "amqp", "kafka", "websocket"] },
      { path: "sync_async", label: "동기/비동기", type: "enum", required: true, enumValues: ["sync", "async"] },
    ],
  },
];

/** Deployment fields shared by all types */
const deploymentFields: FieldDef[] = [
  { path: "deployment.target", label: "배포 대상", type: "enum", required: true, enumValues: ["docker_compose", "kubernetes", "ecs", "lambda", "cloud_run", "fly_io", "railway", "vercel", "bare_metal", "app_store", "play_store", "both_stores"] },
  { path: "deployment.target_rationale", label: "선택 근거", type: "text", required: false },
  {
    path: "deployment.target_alternatives", label: "검토한 대안", type: "array", required: false,
    arrayItemFields: [
      { path: "target", label: "대상", type: "text", required: true },
      { path: "rejection_reason", label: "탈락 이유", type: "text", required: true },
    ],
  },
  {
    path: "deployment.environments", label: "환경", type: "array", required: false,
    arrayItemFields: [
      { path: "name", label: "이름", type: "enum", required: true, enumValues: ["dev", "staging", "production"] },
      { path: "purpose", label: "목적", type: "text", required: true },
      { path: "differences", label: "프로덕션과의 차이", type: "text", required: true },
    ],
  },
  { path: "deployment.ci.tool", label: "CI 도구", type: "enum", required: false, enumValues: ["github_actions", "gitlab_ci", "jenkins", "circleci", "bitbucket_pipelines", "xcode_cloud", "bitrise", "codemagic"] },
  { path: "deployment.ci.pipeline_stages", label: "CI 파이프라인", type: "text", required: false, placeholder: "예: lint -> test -> build -> deploy" },
  { path: "deployment.cd.tool", label: "CD 도구", type: "enum", required: false, enumValues: ["argocd", "fluxcd", "spinnaker", "none", "fastlane", "app_center"] },
  { path: "deployment.cd.strategy", label: "CD 전략", type: "enum", required: false, enumValues: ["gitops", "push", "manual"] },
  { path: "deployment.container_registry", label: "컨테이너 레지스트리", type: "enum", required: false, enumValues: ["dockerhub", "ecr", "gcr", "ghcr", "acr"] },
  { path: "deployment.secrets_management", label: "시크릿 관리", type: "enum", required: false, enumValues: ["env_file", "vault", "aws_ssm", "doppler", "infisical"] },
];

const backendApiFields: FieldDef[] = [
  { path: "language", label: "언어", type: "enum", required: true, enumValues: ["python", "typescript", "java", "go", "rust", "ruby", "csharp", "kotlin"] },
  { path: "framework", label: "프레임워크", type: "enum", required: true, enumValues: ["fastapi", "django", "express", "nestjs", "spring", "gin", "actix", "rails", "aspnet"] },
  { path: "framework_rationale", label: "프레임워크 선택 근거", type: "text", required: false },
  { path: "build_tool", label: "빌드 도구", type: "enum", required: true, enumValues: ["poetry", "pip", "npm", "pnpm", "yarn", "gradle", "maven", "cargo", "go_mod"] },
  {
    path: "key_libraries", label: "핵심 라이브러리", type: "array", required: false,
    arrayItemFields: [
      { path: "name", label: "이름", type: "text", required: true },
      { path: "purpose", label: "용도", type: "text", required: true },
      { path: "version_constraint", label: "버전 제약", type: "text", required: false },
    ],
  },
  { path: "api_style", label: "API 스타일", type: "enum", required: true, enumValues: ["rest", "graphql", "grpc"] },
  { path: "api_style_rationale", label: "API 스타일 근거", type: "text", required: false },
  { path: "api_versioning", label: "API 버전관리", type: "enum", required: false, enumValues: ["url_prefix", "header", "query_param", "none"] },
  { path: "auth.method", label: "인증 방식", type: "enum", required: true, enumValues: ["jwt", "session", "api_key", "oauth2", "none"] },
  { path: "auth.rationale", label: "인증 근거", type: "text", required: false },
  {
    path: "endpoints", label: "REST 엔드포인트", type: "array", required: false,
    description: "api_style이 rest일 때 필수",
    arrayItemFields: [
      { path: "method", label: "메서드", type: "enum", required: true, enumValues: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
      { path: "path", label: "경로", type: "text", required: true, placeholder: "/api/v1/resource" },
      { path: "description", label: "설명", type: "text", required: true },
      { path: "auth_required", label: "인증 필요", type: "boolean", required: false, defaultValue: true },
    ],
  },
];

const webUiFields: FieldDef[] = [
  { path: "language", label: "언어", type: "enum", required: true, enumValues: ["typescript", "javascript"] },
  { path: "framework", label: "프레임워크", type: "enum", required: true, enumValues: ["react", "vue", "svelte", "next", "nuxt", "angular", "solid", "astro"] },
  { path: "framework_rationale", label: "프레임워크 선택 근거", type: "text", required: false },
  { path: "build_tool", label: "빌드 도구", type: "enum", required: true, enumValues: ["vite", "webpack", "turbopack", "pnpm", "npm", "yarn"] },
  { path: "rendering_strategy", label: "렌더링 전략", type: "enum", required: false, enumValues: ["spa", "ssr", "ssg", "isr"] },
  { path: "css_strategy", label: "CSS 전략", type: "enum", required: false, enumValues: ["tailwind", "css_modules", "styled_components", "sass", "vanilla_css", "emotion"] },
  { path: "state_management", label: "상태 관리", type: "enum", required: false, enumValues: ["zustand", "redux", "recoil", "jotai", "context", "pinia", "mobx"] },
  { path: "accessibility_level", label: "접근성 수준", type: "enum", required: false, enumValues: ["wcag_aa", "wcag_aaa", "basic", "none"] },
  { path: "responsive_strategy", label: "반응형 전략", type: "enum", required: false, enumValues: ["mobile_first", "desktop_first"] },
  {
    path: "pages", label: "페이지 목록", type: "array", required: true,
    arrayItemFields: [
      { path: "name", label: "페이지 이름", type: "text", required: true },
      { path: "purpose", label: "목적", type: "text", required: true },
      {
        path: "connected_endpoints", label: "연결 API", type: "array", required: true,
        arrayItemFields: [{ path: "", label: "엔드포인트", type: "text", required: false, placeholder: "POST /api/v1/..." }],
      },
    ],
  },
];

const workerFields: FieldDef[] = [
  { path: "language", label: "언어", type: "enum", required: true, enumValues: ["python", "typescript", "java", "kotlin", "ruby", "go"] },
  { path: "framework", label: "프레임워크", type: "enum", required: true, enumValues: ["celery", "bullmq", "sidekiq", "spring_batch", "temporal"] },
  { path: "framework_rationale", label: "프레임워크 선택 근거", type: "text", required: false },
  { path: "build_tool", label: "빌드 도구", type: "enum", required: true, enumValues: ["poetry", "pip", "npm", "pnpm", "yarn", "gradle", "maven", "go_mod", "bundler"] },
  {
    path: "workers", label: "워커 목록", type: "array", required: true,
    arrayItemFields: [
      { path: "name", label: "워커 이름", type: "text", required: true },
      { path: "responsibility", label: "책임", type: "text", required: true },
      { path: "trigger_type", label: "트리거 유형", type: "enum", required: true, enumValues: ["queue", "cron", "event", "webhook"] },
      { path: "trigger_config", label: "트리거 설정", type: "text", required: true, placeholder: "큐 이름 / cron식 / 이벤트 이름" },
      { path: "idempotent", label: "멱등성", type: "boolean", required: true, defaultValue: false },
      { path: "retry_policy", label: "재시도 정책", type: "text", required: false },
      { path: "timeout", label: "타임아웃", type: "text", required: false, placeholder: "예: 5m" },
    ],
  },
];

const mobileAppFields: FieldDef[] = [
  { path: "approach", label: "접근법", type: "enum", required: true, enumValues: ["native", "cross_platform", "hybrid"] },
  { path: "framework", label: "프레임워크", type: "enum", required: true, enumValues: ["react_native", "flutter", "swift", "kotlin", "swiftui", "jetpack_compose"] },
  { path: "framework_rationale", label: "프레임워크 선택 근거", type: "text", required: false },
  { path: "min_os_versions", label: "최소 OS 버전", type: "text", required: true, placeholder: "예: iOS 15+ / Android 12+" },
  { path: "navigation_pattern", label: "네비게이션 패턴", type: "enum", required: false, enumValues: ["tab", "drawer", "stack", "bottom_nav"] },
  {
    path: "screens", label: "화면 목록", type: "array", required: true,
    arrayItemFields: [
      { path: "name", label: "화면 이름", type: "text", required: true },
      { path: "purpose", label: "목적", type: "text", required: true },
      {
        path: "connected_endpoints", label: "연결 API", type: "array", required: true,
        arrayItemFields: [{ path: "", label: "엔드포인트", type: "text", required: false }],
      },
    ],
  },
  { path: "distribution", label: "배포 방식", type: "enum", required: false, enumValues: ["app_store", "play_store", "enterprise", "both_stores", "testflight"] },
];

const dataPipelineFields: FieldDef[] = [
  { path: "language", label: "언어", type: "enum", required: true, enumValues: ["python", "java", "scala", "sql"] },
  { path: "framework", label: "프레임워크", type: "enum", required: true, enumValues: ["airflow", "dagster", "prefect", "spark", "dbt", "flink"] },
  { path: "framework_rationale", label: "프레임워크 선택 근거", type: "text", required: false },
  { path: "build_tool", label: "빌드 도구", type: "enum", required: true, enumValues: ["poetry", "pip", "gradle", "maven", "sbt"] },
  {
    path: "pipelines", label: "파이프라인 목록", type: "array", required: true,
    arrayItemFields: [
      { path: "name", label: "파이프라인 이름", type: "text", required: true },
      { path: "responsibility", label: "책임", type: "text", required: true },
      { path: "type", label: "유형", type: "enum", required: true, enumValues: ["batch", "streaming", "micro_batch", "hybrid"] },
      { path: "schedule", label: "스케줄", type: "enum", required: true, enumValues: ["cron", "real_time", "trigger_based"] },
      {
        path: "sources", label: "데이터 소스", type: "array", required: true,
        arrayItemFields: [
          { path: "name", label: "이름", type: "text", required: true },
          { path: "system", label: "시스템", type: "text", required: true },
        ],
      },
      {
        path: "sinks", label: "적재 대상", type: "array", required: true,
        arrayItemFields: [
          { path: "name", label: "이름", type: "text", required: true },
          { path: "system", label: "시스템", type: "text", required: true },
        ],
      },
    ],
  },
];

export function getServiceFields(type: string): FieldDef[] {
  const typeFields: Record<string, FieldDef[]> = {
    backend_api: backendApiFields,
    web_ui: webUiFields,
    worker: workerFields,
    mobile_app: mobileAppFields,
    data_pipeline: dataPipelineFields,
  };

  return [
    ...commonFields,
    ...(typeFields[type] ?? []),
    ...deploymentFields,
  ];
}
