import { MANAGER_VIEWS, type ManagerView } from './manager-options';

export interface ManagerSidebarProps {
  activeView: ManagerView;
  onViewChange: (view: ManagerView) => void;
}

export function ManagerSidebar({ activeView, onViewChange }: ManagerSidebarProps) {
  return <nav aria-label="Manager views">
    {MANAGER_VIEWS.map((view) => (
      <button
        aria-current={activeView === view.id ? 'page' : undefined}
        key={view.id}
        onClick={() => onViewChange(view.id)}
        type="button"
      >
        {view.label}
      </button>
    ))}
  </nav>;
}
