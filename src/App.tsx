import Header from './components/Header';
import StatusBar from './components/StatusBar';
import ErrorBoundary from './components/ErrorBoundary';
import MinWidthWarning from './components/MinWidthWarning';
import EditorPanel from './components/editor/EditorPanel';
import PreviewPanel from './components/preview/PreviewPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  useKeyboardShortcuts();

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen min-w-[1024px]">
        <Header />
        <main className="flex flex-1 overflow-hidden">
          <EditorPanel />
          <PreviewPanel />
        </main>
        <StatusBar />
      </div>
      <MinWidthWarning />
    </ErrorBoundary>
  );
}
