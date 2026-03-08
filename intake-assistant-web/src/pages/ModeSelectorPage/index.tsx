import { useNavigate } from "react-router-dom";

import { ModeCard } from "./ModeCard";

const SDWC_WEB_URL = import.meta.env.VITE_SDWC_WEB_URL as string | undefined;

export function ModeSelectorPage() {
  const navigate = useNavigate();

  const handleSimple = () => {
    navigate("/intake");
  };

  const handleAdvanced = () => {
    if (SDWC_WEB_URL) {
      window.location.href = SDWC_WEB_URL;
    } else {
      alert(
        "SDwC 웹 에디터 URL이 설정되지 않았습니다.\n관리자에게 VITE_SDWC_WEB_URL 환경 변수 설정을 요청하세요.",
      );
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">intake-assistant</h1>
        <p className="mt-2 text-gray-500">어떤 방식으로 프로젝트를 시작할까요?</p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <ModeCard
          title="Simple 모드"
          description="대화형 AI가 몇 가지 질문을 통해 프로젝트를 자동 구성합니다."
          target="비개발자, 빠른 프로토타이핑"
          details={[
            "자유 텍스트로 설명",
            "몇 가지 질문에 자유롭게 답변",
            "아키텍처 카드로 결과 확인",
            "ZIP 프로젝트 다운로드",
          ]}
          onClick={handleSimple}
        />
        <ModeCard
          title="Advanced 모드"
          description="intake_data.yaml을 직접 작성하여 세밀하게 프로젝트를 구성합니다."
          target="개발자, 정밀한 제어"
          details={[
            "YAML 템플릿 직접 편집",
            "모든 필드를 수동 제어",
            "SDwC 웹 에디터 사용",
          ]}
          onClick={handleAdvanced}
        />
      </div>
    </main>
  );
}
