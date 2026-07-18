import type { Discipline } from "../data/reviewModel";

type DisciplineCardProps = {
  discipline: Discipline;
  active: boolean;
  onSelect: () => void;
};

export function DisciplineCard({ discipline, active, onSelect }: DisciplineCardProps) {
  return (
    <button className={`discipline-card ${active ? "is-active" : ""}`} onClick={onSelect}>
      <span>
        <strong>{discipline.title}</strong>
        <small>{discipline.role}</small>
      </span>
      <b>{discipline.score}</b>
    </button>
  );
}
