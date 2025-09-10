import { createRoot } from 'react-dom/client'
import { buildApiUrl, API_ENDPOINTS } from '../api/config';
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
