import { createRoot } from 'react-dom/client';

import '../shared/theme.css';
import { t } from '../shared/i18n';
import { initializeTheme } from '../shared/theme';
import { ManagerApp } from './ManagerApp';

document.title = t('manager.title');
void initializeTheme();
createRoot(document.getElementById('root')!).render(<ManagerApp />);
