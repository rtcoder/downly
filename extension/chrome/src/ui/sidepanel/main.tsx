import { createRoot } from 'react-dom/client';

import '../shared/theme.css';
import { t } from '../shared/i18n';
import { initializeTheme } from '../shared/theme';
import { SidePanelApp } from './SidePanelApp';

document.title = t('sidePanel.title');
void initializeTheme();
createRoot(document.getElementById('root')!).render(<SidePanelApp />);
