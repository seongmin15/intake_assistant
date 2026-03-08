import { useNavigate } from "react-router-dom";

import { ModeCard } from "./ModeCard";

export function ModeSelectorPage() {
  const navigate = useNavigate();

  const handleSimple = () => {
    navigate("/intake");
  };

  const handleAdvanced = () => {
    navigate("/advanced");
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
          description="8단계 폼으로 intake_data.yaml의 모든 필드를 세밀하게 제어합니다."
          target="개발자, 정밀한 제어"
          details={[
            "8단계 위저드 (WHY → WHAT-NEXT)",
            "150+ 필드 직접 입력",
            "필드별 AI 추천 지원",
            "실시간 검증 + ZIP 다운로드",
          ]}
          onClick={handleAdvanced}
        />
      </div>
    </main>
  );
}
