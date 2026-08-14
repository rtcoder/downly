import { MANAGER_VIEWS, type ManagerView } from './manager-options';
import { t } from '../../shared/i18n';

export interface ManagerSidebarProps {
  activeView: ManagerView;
  onViewChange: (view: ManagerView) => void;
}

export function ManagerSidebar({ activeView, onViewChange }: ManagerSidebarProps) {
  return <nav aria-label={t('manager.sidebar.label')}>
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
