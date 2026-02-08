import React, { useState, useEffect, useRef } from 'react';
import { FaCheckCircle, FaCamera, FaImage, FaTrash } from 'react-icons/fa';
import { useCity } from '../contexts/CityContext';

const DocumentUpload = ({
  documentType,
  label,
  onFileSelect,
  isUploaded,
  isLoading,
  currentFiles = [],
  onFileDelete
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      // Deduplicate by name+size to avoid duplicates when UI accidentally triggers twice
      const merged = [...selectedFiles, ...files];
      const deduped = [];
      const seen = new Set();
      for (const f of merged) {
        const key = `${f.name}_${f.size}_${f.lastModified || 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(f);
      }
      setSelectedFiles(deduped);
      onFileSelect && onFileSelect(deduped);
    }
    // reset input so the same file can be selected again if needed
    e.target.value = '';
  };

  const { city } = useCity();
  const citySlug = String(city || 'manaus').toLowerCase();

  const renderPreview = (file, idx, isTemporary = false) => {
    // file can be URL string (already uploaded) or a File object
    let src;
    if (typeof file === 'string') {
      // If it already looks like a full uploads path, use as-is
      if (file.startsWith('/uploads/') || file.startsWith('http')) {
        src = file;
      } else if (file.startsWith('uploads/') ) {
        src = '/' + file;
      } else {
        // Normal relative format: "container/file.jpg"
        src = `/uploads/${citySlug}/${file}`;
      }
    } else if (file && typeof file.path === 'string') {
      // backend object (with absolute path) - extract uploads relative path when possible
      try {
        const normalized = file.path.replace(/\\\\/g, '/');
        const idx = normalized.indexOf('/uploads/');
        if (idx >= 0) {
          src = normalized.slice(idx);
        } else {
          const idx2 = normalized.indexOf('uploads/');
          if (idx2 >= 0) src = '/' + normalized.slice(idx2);
          else src = '';
        }
      } catch (e) {
        console.error('Erro ao processar path do arquivo:', e);
        src = '';
      }
    } else {
      try {
        src = URL.createObjectURL(file);
      } catch (e) {
        console.error('Erro ao criar preview do arquivo:', e);
        src = '';
      }
    }

    const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

    return (
      <div key={(isTemporary ? 'tmp-' : '') + idx} className="relative w-24 h-24 rounded overflow-hidden border">
        <img
          src={src || placeholder}
          alt={`doc-${idx}`}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
        />
        <button
          type="button"
          onClick={() => {
            if (isTemporary) {
              // remove from local selection
              setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
            } else {
              onFileDelete && onFileDelete(documentType, idx);
            }
          }}
          className="absolute top-1 right-1 bg-white rounded-full p-1 text-red-600 shadow"
        >
          <FaTrash />
        </button>
      </div>
    );
  };

  // clear temporary previews when upload finishes and server returned files
  useEffect(() => {
    if (!isLoading && currentFiles && currentFiles.length > 0) {
      setSelectedFiles([]);
    }
  }, [isLoading, currentFiles]);

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <label className="text-base font-semibold text-gray-800">{label}</label>
        {isUploaded && <FaCheckCircle className="text-green-500 text-xl" />}
      </div>

      <div className="flex gap-2">
        <div className="flex-1" onClick={() => !isLoading && fileInputRef.current && fileInputRef.current.click()}>
          <div className={`p-3 rounded-lg border-2 border-dashed text-center cursor-pointer transition ${
            isUploaded 
              ? 'border-green-300 bg-green-50' 
              : 'border-blue-300 bg-blue-50 hover:border-blue-400'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div className="flex items-center justify-center gap-2">
              {isUploaded ? (
                <>
                  <FaCheckCircle className="text-green-500" />
                  <span className="text-green-700 font-medium">✅ Anexado</span>
                </>
              ) : (
                <>
                  <FaImage className="text-blue-500" />
                  <span className="text-blue-700 font-medium">{isLoading ? 'Enviando...' : 'Selecionar fotos'}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => !isLoading && fileInputRef.current && fileInputRef.current.click()}
          disabled={isLoading}
          className="px-3 py-2 bg-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-300 disabled:opacity-50"
        >
          <FaCamera />
        </button>
      </div>

      <div className="mt-3 flex gap-2 flex-wrap">
        {currentFiles && currentFiles.length > 0 ? (
          currentFiles.map((f, i) => renderPreview(f, i, false))
        ) : selectedFiles && selectedFiles.length > 0 ? (
          selectedFiles.map((f, i) => renderPreview(f, i, true))
        ) : (
          <div className="text-sm text-gray-500">Nenhuma foto anexada</div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        data-type={documentType}
        onChange={handleFileChange}
        disabled={isLoading}
        multiple
        className="hidden"
      />
    </div>
  );
};

export default DocumentUpload;
