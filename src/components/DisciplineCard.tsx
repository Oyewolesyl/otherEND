import type { Discipline } from "../data/reviewModel";

type DisciplineCardProps = {
  discipline: Discipline;
  active: boolean;
  onSelect: () => void;
};

export function DisciplineCard({ discipline, active, onSelect }: DisciplineCardProps) {
  const Icon = discipline.icon;

  return (
    <button className={`discipline-card ${active ? "is-active" : ""}`} onClick={onSelect}>
      <span className="icon-tile">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span>
        <strong>{discipline.title}</strong>
        <small>{discipline.role}</small>
      </span>
      <b>{discipline.score}</b>
    </button>
  );
}
