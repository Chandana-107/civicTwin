import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';

const PRIORITIES  = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_ICONS = { low: '🟢', medium: '🔵', high: '🟠', urgent: '🔴' };
const CATEGORIES  = ['General', 'Infrastructure', 'Health', 'Education', 'Safety', 'Environment', 'Welfare', 'Transport'];
const DEPARTMENTS = ['Public Works', 'Health Dept', 'Education', 'Police', 'Finance', 'Revenue', 'Water Board', 'Electricity'];

const PRESET_COLORS = ['#ffffff', '#1E3150', '#5377A2', '#601A35', '#059669', '#D97706', '#E5D38A'];

const BLANK_FORM = {
  text: '', imageFile: null, imagePreview: null,
  bgColor: '#ffffff', category: '', department: '', priority: 'medium',
};

const SocialComposePage = () => {
  const { publishPost, publishing } = useOutletContext();

  const [form, setForm]             = useState(BLANK_FORM);
  const [isDragging, setIsDragging] = useState(false);
  const [showEmoji, setShowEmoji]   = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const fileInputRef = useRef(null);
  const toolbarRef = useRef(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setShowEmoji(false);
        setShowColorPicker(false);
      }
    };
    
    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Clean up
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleImageSelection = (file) => {
    if (!file) return;
    setForm((p) => ({ ...p, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const resetForm = () => {
    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    setForm(BLANK_FORM);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowEmoji(false);
    setShowColorPicker(false);
  };

  const removeImage = () => {
    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    setForm((p) => ({ ...p, imageFile: null, imagePreview: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    publishPost(form, resetForm);
  };

  // Determine text color based on background luminance (simple approximation)
  const isDarkBg = form.bgColor !== '#ffffff' && form.bgColor !== '#E5D38A';
  const textColor = isDarkBg ? '#ffffff' : '#1E3150';

  return (
    <div className="sfa-composer">
      <h3>✍️ Create New Post</h3>
      <form onSubmit={handleSubmit}>

        {/* Dynamic WYSIWYG Editor Area */}
        <div 
          className={`sfa-editor-area ${isDragging ? 'dragging' : ''}`}
          style={{ backgroundColor: form.bgColor, color: textColor }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { 
            e.preventDefault(); 
            setIsDragging(false); 
            const f = e.dataTransfer.files?.[0]; 
            if (f) handleImageSelection(f); 
          }}
        >
          <textarea
            className="sfa-editor-textarea"
            value={form.text}
            onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
            placeholder="What's happening in the community?"
            style={{ color: textColor }}
          />

          {/* Image Preview inside the editor */}
          {form.imagePreview && (
            <div className="sfa-editor-image-wrap">
              <img src={form.imagePreview} alt="Attached media" className="sfa-editor-image" />
              <button type="button" className="sfa-editor-image-remove" onClick={removeImage} title="Remove image">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Unified Toolbar */}
        <div className="sfa-editor-toolbar" ref={toolbarRef}>
          <div className="sfa-toolbar-actions">
            
            {/* Image Attachment */}
            <button type="button" className="sfa-toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Attach Image">
              📎 Image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => handleImageSelection(e.target.files?.[0])} />

            {/* Emoji Popover */}
            <div style={{ position: 'relative' }}>
              <button type="button" className={`sfa-toolbar-btn ${showEmoji ? 'active' : ''}`} onClick={() => { setShowEmoji(!showEmoji); setShowColorPicker(false); }} title="Insert Emoji">
                😀 Emoji
              </button>
              {showEmoji && (
                <div className="sfa-popover">
                  <EmojiPicker onEmojiClick={(d) => setForm((p) => ({ ...p, text: p.text + d.emoji }))}
                    autoFocusSearch={false} width={310} height={350} />
                </div>
              )}
            </div>

            {/* Background Color Popover */}
            <div style={{ position: 'relative' }}>
              <button type="button" className={`sfa-toolbar-btn ${showColorPicker ? 'active' : ''}`} onClick={() => { setShowColorPicker(!showColorPicker); setShowEmoji(false); }} title="Background Color">
                🎨 Background
              </button>
              {showColorPicker && (
                <div className="sfa-popover sfa-color-popover">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.8rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5377A2' }}>HEX</span>
                    <input 
                      type="text" 
                      className="sfa-input"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', flex: 1, fontFamily: 'monospace' }}
                      value={form.bgColor}
                      onChange={(e) => setForm((p) => ({ ...p, bgColor: e.target.value }))}
                      placeholder="#FFFFFF"
                    />
                  </div>
                  <div className="sfa-color-grid">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button"
                        className={`sfa-color-swatch ${form.bgColor === c ? 'active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setForm((p) => ({ ...p, bgColor: c }))}
                      />
                    ))}
                    <label className="sfa-color-swatch-custom" title="OS Color Picker" style={{ position: 'relative', overflow: 'hidden' }}>
                      <span style={{ position: 'relative', zIndex: 1 }}>+</span>
                      <input type="color" value={form.bgColor !== '#ffffff' ? form.bgColor : '#1E3150'}
                        onChange={(e) => setForm((p) => ({ ...p, bgColor: e.target.value }))}
                        style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 2 }} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Post Metrics / Word Count could go here, currently empty for balance */}
          <div className="sfa-toolbar-meta"></div>
        </div>

        {/* Metadata Settings Grid */}
        <div className="sfa-settings-panel">
          <div className="sfa-settings-row">
            <div className="sfa-form-group">
              <label>Category</label>
              <select className="sfa-select" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                <option value="">— Select Category —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sfa-form-group">
              <label>Department</label>
              <select className="sfa-select" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}>
                <option value="">— Select Department —</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="sfa-form-group">
            <label>Priority</label>
            <div className="sfa-priority-row">
              {PRIORITIES.map((p) => (
                <button key={p} type="button"
                  className={`sfa-priority-chip ${p}${form.priority === p ? ' selected' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, priority: p }))}>
                  {PRIORITY_ICONS[p]} {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sfa-composer-actions">
          <button type="button" className="sfa-btn sfa-btn-ghost" onClick={resetForm}>Clear</button>
          <button type="submit" className="sfa-btn sfa-btn-primary" disabled={publishing}>
            {publishing ? '⏳ Publishing…' : '🚀 Publish Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SocialComposePage;
