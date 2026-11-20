/** Stands in for the task field and the list while they load, in their sizes, so nothing jumps when they arrive. */
export function TaskSkeleton() {
  return <div className="task-skeleton" aria-hidden="true">
    <div className="skeleton-entry" />
    <div className="skeleton-line" />
    <div className="skeleton-options" />
    <div className="skeleton-toolbar"><span /><span /></div>
    <div className="skeleton-list">
      <div className="skeleton-head" />
      {[72, 48, 64, 40].map((width) => <div className="skeleton-row" key={width}>
        <span /><span style={{ width: `${width}%` }} /><span /><span />
      </div>)}
    </div>
  </div>;
}
