import { createRoot } from 'react-dom/client';

import '../shared/theme.css';
import { initializeTheme } from '../shared/theme';
import { SidePanelApp } from './SidePanelApp';

void initializeTheme();
createRoot(document.getElementById('root')!).render(<SidePanelApp />);
