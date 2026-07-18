import type { Artifact } from "../data/reviewModel";

type ArtifactCardProps = {
  artifact: Artifact;
};

export function ArtifactCard({ artifact }: ArtifactCardProps) {
  return (
    <article className="artifact-card">
      <div className="artifact-head">
        <span className={`status status-${artifact.status.replace(" ", "-")}`}>{artifact.status}</span>
      </div>
      <h3>{artifact.title}</h3>
      <p>{artifact.description}</p>
    </article>
  );
}
