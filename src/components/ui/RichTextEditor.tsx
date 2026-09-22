import { useRef, useCallback, useState, useEffect } from 'react';

import { dbClient } from '@/lib/dbClient';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Quote, Code, Link as LinkIcon, Image as ImageIcon, Video,
  Undo, Redo, Paperclip, Loader2, X,
} from 'lucide-react';

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  path: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  userId?: string;
  onFilesChange?: (files: UploadedFile[]) => void;
  files?: UploadedFile[];
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type your message...',
  minHeight = 150,
  userId,
  onFilesChange,
  files = [],
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const uploadFile = useCallback(async (file: File, folder: string): Promise<UploadedFile | null> => {
    if (!userId) return null;
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await dbClient.storage
      .from('attachments')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = dbClient.storage.from('attachments').getPublicUrl(path);
    return {
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      path,
    };
  }, [userId]);

  const insertImage = useCallback(async (file: File) => {
    setUploading(true);
    const uploaded = await uploadFile(file, 'images');
    setUploading(false);
    if (uploaded && editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertImage', false, uploaded.url);
      onChange(editorRef.current.innerHTML);
    }
  }, [uploadFile, onChange]);

  const insertVideo = useCallback(async (file: File) => {
    setUploading(true);
    const uploaded = await uploadFile(file, 'videos');
    setUploading(false);
    if (uploaded && editorRef.current) {
      const videoHtml = `<video controls src="${uploaded.url}" style="max-width:100%;border-radius:8px;"></video><br/>`;
      editorRef.current.focus();
      document.execCommand('insertHTML', false, videoHtml);
      onChange(editorRef.current.innerHTML);
    }
  }, [uploadFile, onChange]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!onFilesChange) return;
    setUploading(true);
    const uploadedFiles: UploadedFile[] = [];
    for (const file of Array.from(files)) {
      const uploaded = await uploadFile(file, 'files');
      if (uploaded) uploadedFiles.push(uploaded);
    }
    setUploading(false);
    onFilesChange([...files, ...uploadedFiles] as UploadedFile[]);
  }, [uploadFile, onFilesChange, files]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) insertImage(file);
    e.target.value = '';
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) insertVideo(file);
    e.target.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
    }
    e.target.value = '';
  };

  const insertLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) exec('createLink', url);
  };

  const removeFile = (index: number) => {
    if (onFilesChange) {
      onFilesChange(files.filter((_, i) => i !== index));
    }
  };

  interface ToolbarBtn {
    icon: typeof Bold;
    cmd: string;
    val?: string;
    title: string;
  }

  const toolbarBtns: ToolbarBtn[] = [
    { icon: Bold, cmd: 'bold', title: 'Bold' },
    { icon: Italic, cmd: 'italic', title: 'Italic' },
    { icon: Underline, cmd: 'underline', title: 'Underline' },
    { icon: Strikethrough, cmd: 'strikeThrough', title: 'Strikethrough' },
  ];

  const listBtns: ToolbarBtn[] = [
    { icon: List, cmd: 'insertUnorderedList', title: 'Bullet List' },
    { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbered List' },
    { icon: Quote, cmd: 'formatBlock', val: 'blockquote', title: 'Quote' },
    { icon: Code, cmd: 'formatBlock', val: 'pre', title: 'Code Block' },
  ];

  // Sync value to editorRef DOM element without resetting cursor position during active typing
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      if (editorRef.current.innerHTML !== (value || '')) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  return (

    <div className="rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-colors">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
        {toolbarBtns.map((btn) => (
          <button
            key={btn.cmd}
            type="button"
            title={btn.title}
            onClick={() => exec(btn.cmd, btn.val)}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <btn.icon className="w-4 h-4" />
          </button>
        ))}
        <div className="w-px h-5 bg-gray-300 mx-1" />
        {listBtns.map((btn) => (
          <button
            key={`${btn.cmd}-${btn.title}`}
            type="button"
            title={btn.title}
            onClick={() => exec(btn.cmd, btn.val)}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <btn.icon className="w-4 h-4" />
          </button>
        ))}
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" title="Insert Link" onClick={insertLink} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors">
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" title="Insert Image" onClick={() => imageInputRef.current?.click()} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors">
          <ImageIcon className="w-4 h-4" />
        </button>
        <button type="button" title="Insert Video" onClick={() => videoInputRef.current?.click()} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors">
          <Video className="w-4 h-4" />
        </button>
        <button type="button" title="Attach File" onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors">
          <Paperclip className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" title="Undo" onClick={() => exec('undo')} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors">
          <Undo className="w-4 h-4" />
        </button>
        <button type="button" title="Redo" onClick={() => exec('redo')} className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors">
          <Redo className="w-4 h-4" />
        </button>
        {uploading && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-blue-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
          </div>
        )}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="px-3.5 py-2.5 text-sm text-gray-900 outline-none overflow-y-auto rich-text-editor"
        style={{ minHeight }}
      />


      {/* File attachments list */}
      {files.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 space-y-1.5">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg border border-gray-200 px-2.5 py-1.5">
              <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate flex-1">
                {file.name}
              </a>
              <span className="text-gray-400 flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
      <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
      <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
    </div>
  );
}
