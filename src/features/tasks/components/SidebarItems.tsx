import type { ReactNode } from "react";
import { Icon, type IconName } from "@/lib/Icon";

/** The pieces the sidebar is made of: a group that opens, a view with its count, and a failed load. */
export function NavGroup({ name, label, icon, open, currentLabel, onToggle, action, children }: {
  name: string; label: string; icon: IconName; open: boolean; currentLabel?: string; onToggle: () => void; action?: ReactNode; children: ReactNode;
}) {
  const hiddenSelection = open ? undefined : currentLabel;
  return <div className="nav-group">
    <div className="nav-group-header">
      <button type="button" className={`nav-item nav-group-toggle${hiddenSelection ? " is-active" : ""}`}
        aria-label={label} aria-current={hiddenSelection ? "true" : undefined} aria-description={hiddenSelection}
        title={hiddenSelection ? `${label} · ${hiddenSelection}` : label} aria-expanded={open} aria-controls={`nav-${name}`} onClick={onToggle}>
        <Icon name={icon} /><span>{label}</span><Icon name="chevron-right" size={14} className="nav-disclosure" />
      </button>
      {action}
    </div>
    <div id={`nav-${name}`} className="nav-group-items" hidden={!open}>{children}</div>
  </div>;
}

export function NavItem({ label, icon, count, active, onClick, ariaLabel }: {
  label: string; icon?: IconName; count: number; active: boolean; onClick: () => void; ariaLabel: string;
}) {
  return <button type="button" className={`nav-item${active ? " is-active" : ""}`}
    aria-current={active ? "page" : undefined} aria-label={ariaLabel} title={label} onClick={onClick}>
    {icon && <Icon name={icon} />}<span className="nav-text">{label}</span>{" "}<span className="nav-count">{count}</span>
  </button>;
}

export function LoadFailure({ message, retry, onRetry }: { message: string; retry: string; onRetry: () => void }) {
  return <div>
    <p role="alert">{message}</p>
    <button type="button" className="nav-item" aria-label={`${retry} · ${message}`} onClick={onRetry}>
      <span>{retry}</span>
    </button>
  </div>;
}
