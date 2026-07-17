import type { CSSProperties } from "react";

type ScoreRingProps = {
  score: number;
  label: string;
};

export function ScoreRing({ score, label }: ScoreRingProps) {
  return (
    <div className="score-ring" style={{ "--score": `${score}%` } as CSSProperties}>
      <div>
        <strong>{score}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
