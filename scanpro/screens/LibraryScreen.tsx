import React, { useEffect, useState } from 'react';
import { loadDocuments, removeDocument } from '../store';
import { DocumentItem } from '../types';

interface LibraryScreenProps {
  onScan: () => void;
  onViewDoc: (id: string) => void;
}

const LibraryScreen: React.FC<LibraryScreenProps> = ({ onScan, onViewDoc }) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [filter, setFilter] = useState<'All' | 'PDF' | 'Images'>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setDocs(loadDocuments());
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this document?')) {
      removeDocument(id);
      setDocs(loadDocuments());
    }
  };

  const filteredDocs = docs.filter(doc => {
    const matchesFilter = filter === 'All' 
      ? true 
      : filter === 'PDF' ? doc.type === 'pdf' : doc.type === 'jpg';
    const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-up pb-20 lg:pb-0">
      
      {/* Top Section */}
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-white">Documents</h1>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full lg:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-500" style={{fontSize: 18}}>search</span>
            <input 
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-zinc-500 pl-9 pr-3 outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3">
            {/* Filters */}
            <div className="flex items-center gap-2">
              {['All', 'PDF', 'Images'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`h-7 px-3 rounded-md text-xs font-medium border transition-colors
                    ${filter === f 
                      ? 'bg-white/[0.08] text-white border-white/[0.1]' 
                      : 'text-zinc-400 hover:text-zinc-300 border-transparent'}
                  `}
                >
                  {f}
                </button>
              ))}
            </div>
            
            {/* Refresh */}
            <button 
              onClick={() => setDocs(loadDocuments())}
              className="size-8 rounded-lg hover:bg-white/[0.04] text-zinc-400 flex items-center justify-center"
            >
              <span className="material-symbols-outlined" style={{fontSize: 20}}>refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <span className="material-symbols-outlined text-zinc-700 mb-4" style={{fontSize: 48}}>document_scanner</span>
          <h3 className="text-sm font-medium text-zinc-400">No documents yet</h3>
          <p className="text-sm text-zinc-600 mt-1">Scan your first document to get started</p>
          <button 
            onClick={onScan}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 h-9 px-4 rounded-lg text-sm text-white font-medium transition-all"
          >
            Start Scanning
          </button>
        </div>
      ) : (
        /* Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredDocs.map((doc) => (
            <div 
              key={doc.id}
              onClick={() => onViewDoc(doc.id)}
              className="group rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden cursor-pointer transition-all duration-150 hover:border-white/[0.1] hover:bg-white/[0.04] hover:scale-[1.01]"
            >
              {/* Thumbnail */}
              <div className="aspect-[3/4] bg-zinc-900 relative overflow-hidden">
                {doc.thumbnail ? (
                  <img src={doc.thumbnail} alt={doc.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-zinc-700">description</span>
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                
                {/* Type Badge */}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-black/50 text-zinc-300 border border-white/[0.06]">
                  {doc.type}
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  className="absolute top-2 left-2 size-6 rounded bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                >
                  <span className="material-symbols-outlined" style={{fontSize: 14}}>close</span>
                </button>
              </div>

              {/* Info */}
              <div className="p-2.5">
                <h4 className="text-xs font-medium text-zinc-200 truncate" title={doc.title}>{doc.title}</h4>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-zinc-500">{doc.date}</span>
                  <span className="text-[11px] text-zinc-500">{doc.size}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB Mobile */}
      <button 
        onClick={onScan}
        className="lg:hidden fixed bottom-20 right-4 size-12 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center active:scale-[0.95] z-30"
      >
        <span className="material-symbols-outlined">add</span>
      </button>

    </div>
  );
};

export default LibraryScreen;
