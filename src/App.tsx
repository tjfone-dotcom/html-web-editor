import Header from './components/Header';
import StatusBar from './components/StatusBar';
import EditorPanel from './components/editor/EditorPanel';
import PreviewPanel from './components/preview/PreviewPanel';

export default function App() {
  return (
    <div className="flex flex-col h-screen min-w-[1024px]">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <EditorPanel />
        <PreviewPanel />
      </main>
      <StatusBar />
    </div>
  );
}
