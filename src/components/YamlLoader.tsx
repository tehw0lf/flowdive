import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, ChevronRight, FolderOpen, Folder, Loader2, AlertCircle } from 'lucide-react';

function GithubMark({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 98 96" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" />
    </svg>
  );
}

interface YamlLoaderProps {
  onLoad: (files: { name: string; content: string }[]) => void;
}

const SAMPLE_WORKFLOW = `name: CI Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
        description: Target environment
        required: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install deps
        run: npm ci
      - name: Lint
        run: npm run lint

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint
    timeout-minutes: 20
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node \${{ matrix.node }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
      - run: npm ci
      - run: npm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: \${{ github.event.inputs.environment || 'staging' }}
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
      - name: Deploy to cloud
        run: |
          echo "Deploying to \${{ github.event.inputs.environment }}"
          ./deploy.sh
        env:
          DEPLOY_TOKEN: \${{ secrets.DEPLOY_TOKEN }}
`;

// ─── File system helpers ──────────────────────────────────────────────────────

function isYaml(name: string) {
  return name.endsWith('.yml') || name.endsWith('.yaml');
}

function readFileEntry(entry: FileSystemFileEntry): Promise<{ name: string; content: string }> {
  return new Promise((resolve, reject) => {
    entry.file(file => {
      const reader = new FileReader();
      reader.onload = e => resolve({ name: file.name, content: e.target?.result as string });
      reader.onerror = reject;
      reader.readAsText(file);
    }, reject);
  });
}

function readDirEntry(entry: FileSystemDirectoryEntry): Promise<{ name: string; content: string }[]> {
  return new Promise((resolve, reject) => {
    const reader = entry.createReader();
    const results: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries(entries => {
        if (entries.length === 0) {
          Promise.all(
            results.map(e => {
              if (e.isFile && isYaml(e.name)) return readFileEntry(e as FileSystemFileEntry);
              if (e.isDirectory) return readDirEntry(e as FileSystemDirectoryEntry);
              return Promise.resolve([]);
            })
          ).then(nested => resolve(nested.flat() as { name: string; content: string }[])).catch(reject);
        } else {
          results.push(...entries);
          readBatch();
        }
      }, reject);
    };
    readBatch();
  });
}

async function readDropItems(dataTransfer: DataTransfer): Promise<{ name: string; content: string }[]> {
  const items = Array.from(dataTransfer.items);
  const hasEntrySupport = items.length > 0 && typeof items[0].webkitGetAsEntry === 'function';
  if (hasEntrySupport) {
    const results: { name: string; content: string }[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry();
      if (!entry) continue;
      if (entry.isFile && isYaml(entry.name)) results.push(await readFileEntry(entry as FileSystemFileEntry));
      else if (entry.isDirectory) results.push(...await readDirEntry(entry as FileSystemDirectoryEntry));
    }
    if (results.length > 0) return results;
  }
  const fallback: { name: string; content: string }[] = [];
  await Promise.all(Array.from(dataTransfer.files).map(file => {
    if (!isYaml(file.name)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => { fallback.push({ name: file.name, content: e.target?.result as string }); resolve(); };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }));
  return fallback;
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

interface GhFile { name: string; download_url: string; type: string; }

async function fetchWorkflowsFromGitHub(
  repo: string,
  token: string,
  path = '.github/workflows'
): Promise<{ name: string; content: string }[]> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
  if (!res.ok) {
    const msg = res.status === 404 ? `Repo or path not found: ${repo}`
      : res.status === 401 ? 'Invalid token'
      : res.status === 403 ? 'Rate limit exceeded – add a token'
      : `GitHub API error ${res.status}`;
    throw new Error(msg);
  }

  const items: GhFile[] = await res.json();
  const yamlFiles = items.filter(f => f.type === 'file' && isYaml(f.name));

  const contents = await Promise.all(
    yamlFiles.map(async f => {
      const r = await fetch(f.download_url, token ? { headers } : {});
      return { name: f.name, content: await r.text() };
    })
  );
  return contents;
}

// ─── Tab type ────────────────────────────────────────────────────────────────

type Tab = 'local' | 'github' | 'paste';

// ─── Component ────────────────────────────────────────────────────────────────

export function YamlLoader({ onLoad }: YamlLoaderProps) {
  const [tab, setTab] = useState<Tab>('github');
  const [dragOver, setDragOver] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  // GitHub tab state
  const [repo, setRepo] = useState('tehw0lf/workflows');
  const [token, setToken] = useState('');
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState('');

  // Paste tab state
  const [pasteValue, setPasteValue] = useState('');

  const handleParsed = useCallback((files: { name: string; content: string }[]) => {
    if (files.length === 0) return;
    setLoadedFiles(prev => Array.from(new Set([...prev, ...files.map(f => f.name)])));
    onLoad(files);
  }, [onLoad]);

  const handleFileList = useCallback((fileList: FileList) => {
    const readers: Promise<{ name: string; content: string }>[] = [];
    for (const file of fileList) {
      if (isYaml(file.name)) {
        readers.push(new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve({ name: file.name, content: e.target?.result as string });
          reader.onerror = reject;
          reader.readAsText(file);
        }));
      }
    }
    Promise.all(readers).then(handleParsed);
  }, [handleParsed]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = await readDropItems(e.dataTransfer);
    handleParsed(files);
  }, [handleParsed]);

  const handleGitHub = async () => {
    if (!repo.trim()) return;
    setGhLoading(true);
    setGhError('');
    try {
      const files = await fetchWorkflowsFromGitHub(repo.trim(), token.trim());
      handleParsed(files);
    } catch (e) {
      setGhError((e as Error).message);
    } finally {
      setGhLoading(false);
    }
  };

  const handlePaste = () => {
    if (!pasteValue.trim()) return;
    handleParsed([{ name: `pasted-${Date.now()}.yml`, content: pasteValue }]);
    setPasteValue('');
  };

  const tabClass = (t: Tab) =>
    `px-3 py-1.5 text-xs font-mono rounded transition-colors ${
      tab === t
        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
        : 'text-gray-500 hover:text-gray-300 border border-transparent'
    }`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg"
      >
        {/* Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: '0.6s' }} />
          </div>
          <h1 className="text-3xl font-black font-mono text-blue-400 tracking-wider mb-1">
            WORKFLOW<span className="text-teal-400">VIZ</span>
          </h1>
          <p className="text-gray-500 text-sm font-mono">GitHub Actions Visualizer</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          <button className={tabClass('github')} onClick={() => setTab('github')}>
            <GithubMark size={10} className="inline mr-1" />GITHUB
          </button>
          <button className={tabClass('local')} onClick={() => setTab('local')}>
            <FolderOpen size={10} className="inline mr-1" />LOCAL
          </button>
          <button className={tabClass('paste')} onClick={() => setTab('paste')}>
            <Upload size={10} className="inline mr-1" />PASTE
          </button>
          <button
            onClick={() => handleParsed([{ name: 'ci-pipeline.yml', content: SAMPLE_WORKFLOW }])}
            className="ml-auto px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-400 border border-transparent transition-colors"
          >
            sample
          </button>
        </div>

        {/* Tab panels */}
        <div className="hud-panel border border-blue-500/20 rounded-xl overflow-hidden">

          {/* GitHub tab */}
          {tab === 'github' && (
            <div className="p-6 space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-mono uppercase tracking-wider block mb-1">
                  Repository
                </label>
                <input
                  value={repo}
                  onChange={e => setRepo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGitHub()}
                  placeholder="owner/repo"
                  className="w-full bg-black/40 border border-blue-500/20 rounded px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-400/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-mono uppercase tracking-wider block mb-1">
                  Token <span className="text-gray-700 normal-case">(optional · private repos)</span>
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGitHub()}
                  placeholder="ghp_..."
                  className="w-full bg-black/40 border border-blue-500/20 rounded px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-400/50"
                />
              </div>

              {ghError && (
                <div className="flex items-center gap-2 text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                  <AlertCircle size={12} />
                  {ghError}
                </div>
              )}

              <button
                onClick={handleGitHub}
                disabled={ghLoading || !repo.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-blue-500/30 text-blue-400 text-xs font-mono hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {ghLoading
                  ? <><Loader2 size={12} className="animate-spin" />FETCHING...</>
                  : <><GithubMark size={12} />LOAD FROM GITHUB</>
                }
              </button>
            </div>
          )}

          {/* Local tab */}
          {tab === 'local' && (
            <div
              className={`p-8 text-center transition-all duration-200 ${dragOver ? 'bg-blue-500/10' : ''}`}
              onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
              onDrop={handleDrop}
            >
              <input ref={fileInputRef} type="file" multiple accept=".yml,.yaml" className="hidden"
                onChange={e => e.target.files && handleFileList(e.target.files)} />
              <input ref={dirInputRef} type="file"
                // @ts-expect-error – non-standard but widely supported
                webkitdirectory="" multiple className="hidden"
                onChange={e => e.target.files && handleFileList(e.target.files)} />

              <FolderOpen size={28} className="mx-auto mb-3 text-blue-400/50" />
              <p className="text-gray-400 font-mono text-sm mb-1">Drop files or folders here</p>
              <p className="text-gray-600 font-mono text-xs mb-4">.yml / .yaml</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-blue-500/30 text-blue-400 text-xs font-mono hover:bg-blue-500/10 transition-colors">
                  <FileText size={11} />FILES
                </button>
                <button onClick={() => dirInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-teal-500/30 text-teal-400 text-xs font-mono hover:bg-teal-500/10 transition-colors">
                  <Folder size={11} />FOLDER
                </button>
              </div>
            </div>
          )}

          {/* Paste tab */}
          {tab === 'paste' && (
            <div className="p-4">
              <textarea
                value={pasteValue}
                onChange={e => setPasteValue(e.target.value)}
                placeholder="Paste GitHub Actions YAML here..."
                className="w-full h-48 bg-black/40 border border-blue-500/20 rounded px-3 py-2 text-xs font-mono text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-400/40"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setPasteValue('')}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors">
                  <X size={10} />CLEAR
                </button>
                <button onClick={handlePaste} disabled={!pasteValue.trim()}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-mono text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight size={10} />PARSE
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loaded files */}
        <AnimatePresence>
          {loadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-1 max-h-40 overflow-y-auto scrollbar-thin"
            >
              {loadedFiles.map(f => (
                <div key={f} className="flex items-center gap-2 text-xs font-mono text-green-300 px-3 py-1 bg-green-500/10 rounded border border-green-500/20">
                  <FileText size={10} />
                  {f}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
