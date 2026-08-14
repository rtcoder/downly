import { createRoot } from 'react-dom/client';

import '../shared/theme.css';
import { initializeTheme } from '../shared/theme';
import { ManagerApp } from './ManagerApp';

void initializeTheme();
createRoot(document.getElementById('root')!).render(<ManagerApp />);
