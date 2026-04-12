"use client";

import { useParams } from "next/navigation";

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  return (
    <div className="flex h-screen">
      {/* Left pane: question */}
      <div className="w-1/2 p-6 border-r border-gray-700 overflow-y-auto">
        {/* TODO: QuestionPanel, HintDrawer */}
        <p className="text-gray-400">Session {sessionId} — question panel</p>
      </div>

      {/* Right pane: editor + terminal */}
      <div className="w-1/2 flex flex-col">
        <div className="flex-1">
          {/* TODO: CodeEditor / ImageUploadZone / MultipleChoiceCard / OpenEndedInput */}
        </div>
        <div className="h-48 border-t border-gray-700">
          {/* TODO: TerminalOutput */}
        </div>
      </div>
    </div>
  );
}
