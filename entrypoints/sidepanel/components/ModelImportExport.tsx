import { useRef } from 'react';
import { Settings } from '../types';
import { ExportIcon, ImportIcon } from './Icons';

interface ModelImportExportProps {
  settings: Settings;
  status: string;
  setStatus: (s: 'idle' | 'loading' | 'ready' | 'error') => void;
  setProgress: (p: { progress: number; text: string }) => void;
  setError: (e: string) => void;
  t: Record<string, string>;
}

export function ModelImportExport({ settings, status, setStatus, setProgress, setError, t }: ModelImportExportProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pkgInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setStatus('loading');
    setProgress({ progress: 0, text: t.importing });
    try {
      const cache = await caches.open('webllm/model');
      const total = files.length;
      let count = 0;
      const modelId = settings.localModel;
      const baseUrl = `https://huggingface.co/mlc-ai/${modelId}/resolve/main/`;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
        if (!relativePath) continue;
        const url = new URL(relativePath, baseUrl).toString();
        await cache.put(url, new Response(file));
        count++;
        setProgress({ progress: (count / total) * 100, text: `${t.importing} (${count}/${total})` });
      }
      alert(t.import_success);
      setStatus('idle');
    } catch (err: unknown) {
      setError(`${t.import_failed}: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('error');
    }
  };

  const handleExportModel = async () => {
    setStatus('loading');
    setProgress({ progress: 0, text: t.exporting });
    try {
      const cache = await caches.open('webllm/model');
      const keys = await cache.keys();
      const modelId = settings.localModel;
      const filteredKeys = keys.filter(req => req.url.includes(modelId));
      if (filteredKeys.length === 0) { alert('No cached files found for this model.'); setStatus('ready'); return; }

      const filesData: { url: string; blob: Blob }[] = [];
      for (let i = 0; i < filteredKeys.length; i++) {
        const resp = await cache.match(filteredKeys[i]);
        if (resp) filesData.push({ url: filteredKeys[i].url, blob: await resp.blob() });
        setProgress({ progress: ((i + 1) / filteredKeys.length) * 50, text: `${t.exporting} (${i + 1}/${filteredKeys.length})` });
      }

      let totalSize = 8;
      for (const f of filesData) totalSize += 4 + f.url.length + 8 + f.blob.size;
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);
      const encoder = new TextEncoder();
      view.setUint32(0, 0x4d4c4350);
      view.setUint32(4, filesData.length);
      let offset = 8;
      for (let i = 0; i < filesData.length; i++) {
        const f = filesData[i];
        const urlBytes = encoder.encode(f.url);
        view.setUint32(offset, urlBytes.length);
        new Uint8Array(buffer, offset + 4, urlBytes.length).set(urlBytes);
        offset += 4 + urlBytes.length;
        view.setBigUint64(offset, BigInt(f.blob.size));
        const blobData = new Uint8Array(await f.blob.arrayBuffer());
        new Uint8Array(buffer, offset + 8, f.blob.size).set(blobData);
        offset += 8 + f.blob.size;
        setProgress({ progress: 50 + ((i + 1) / filesData.length) * 50, text: `${t.exporting} (Packing ${i + 1}/${filesData.length})` });
      }
      const finalBlob = new Blob([buffer], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${modelId}.mlcp`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      setStatus('ready');
      alert(t.export_success);
    } catch (err: unknown) {
      console.error('Export failed:', err);
      alert(t.export_failed);
      setStatus('ready');
    }
  };

  const handleImportPackage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('loading');
    setProgress({ progress: 0, text: t.importing });
    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);
      const decoder = new TextDecoder();
      if (view.getUint32(0) !== 0x4d4c4350) throw new Error('Invalid MLCP file format');
      const fileCount = view.getUint32(4);
      const cache = await caches.open('webllm/model');
      let offset = 8;
      for (let i = 0; i < fileCount; i++) {
        const urlLen = view.getUint32(offset);
        const url = decoder.decode(new Uint8Array(buffer, offset + 4, urlLen));
        offset += 4 + urlLen;
        const size = Number(view.getBigUint64(offset));
        const data = new Uint8Array(buffer, offset + 8, size);
        offset += 8 + size;
        await cache.put(url, new Response(data));
        setProgress({ progress: ((i + 1) / fileCount) * 100, text: `${t.importing} (${i + 1}/${fileCount})` });
      }
      alert(t.import_success);
      setStatus('idle');
    } catch (err: unknown) {
      alert(`${t.import_failed}: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-white border border-slate-200 rounded-xl dark:bg-brand-dark-surface dark:border-slate-700">
      <h3 className="m-0 text-sm font-bold text-slate-800 dark:text-slate-200">{t.offline_import_title}</h3>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-slate-500 mb-2">{t.offline_import_tip}</p>
        <div className="flex flex-col gap-2 relative">
          <button
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer transition-all w-full hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-dark-bg dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
            onClick={() => folderInputRef.current?.click()}
          >
            {t.offline_import_btn}
          </button>
          <input ref={folderInputRef} type="file" webkitdirectory="true" className="hidden" onChange={handleFileImport} />
          <div className="flex gap-2">
            <button
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer transition-all flex-1 text-xs hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-dark-bg dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
              onClick={handleExportModel}
              disabled={status === 'loading'}
            >
              <ExportIcon /> {t.export_btn}
            </button>
            <button
              className="flex items-center justify-center gap-1.5 py-2 px-3 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer transition-all flex-1 text-xs hover:bg-brand-orange-light hover:border-brand-orange hover:text-brand-orange hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-brand-dark-bg dark:border-slate-700 dark:text-slate-400 dark:hover:bg-[#2d1f10] dark:hover:border-brand-orange dark:hover:text-[#ff7a3d]"
              onClick={() => pkgInputRef.current?.click()}
              disabled={status === 'loading'}
            >
              <ImportIcon /> {t.import_pkg_btn}
            </button>
            <input ref={pkgInputRef} type="file" accept=".mlcp" className="hidden" onChange={handleImportPackage} />
          </div>
        </div>
      </div>
    </div>
  );
}
