import type { Artifact } from "../data/reviewModel";

type ArtifactCardProps = {
  artifact: Artifact;
};

export function ArtifactCard({ artifact }: ArtifactCardProps) {
  const Icon = artifact.icon;

  return (
    <article className="artifact-card">
      <div className="artifact-head">
        <span className="icon-tile">
          <Icon size={19} aria-hidden="true" />
        </span>
        <span className={`status status-${artifact.status.replace(" ", "-")}`}>{artifact.status}</span>
      </div>
      <h3>{artifact.title}</h3>
      <p>{artifact.description}</p>
    </article>
  );
}
