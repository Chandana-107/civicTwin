import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';

const PRIORITIES  = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_ICONS = { low: '🟢', medium: '🔵', high: '🟠', urgent: '🔴' };
const CATEGORIES  = ['General', 'Infrastructure', 'Health', 'Education', 'Safety', 'Environment', 'Welfare', 'Transport'];
const DEPARTMENTS = ['Public Works', 'Health Dept', 'Education', 'Police', 'Finance', 'Revenue', 'Water Board', 'Electricity'];

const BLANK_FORM = {
  text: '', imageFile: null, imagePreview: null,
  bgColor: '#1E3150', category: '', department: '', priority: 'medium',
};

const SocialComposePage = () => {
  const { publishPost, publishing } = useOutletContext();

  const [form, setForm]             = useState(BLANK_FORM);
  const [isDragging, setIsDragging] = useState(false);
  const [showEmoji, setShowEmoji]   = useState(false);

  const handleImageSelection = (file) => {
    if (!file) return;
    setForm((p) => ({ ...p, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const resetForm = () => {
    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    setForm(BLANK_FORM);
    const fi = document.getElementById('sc-image-input');
    if (fi) fi.value = '';
    setShowEmoji(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    publishPost(form, resetForm);
  };

  return (
    <div className="sfa-composer">
      <h3>✍️ Create New Post</h3>
      <form onSubmit={handleSubmit}>

        {/* Post content */}
        <div className="sfa-form-group" style={{ marginBottom: '0.85rem' }}>
          <label>Post Content</label>
          <textarea
            className="sfa-textarea"
            value={form.text}
            onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
            placeholder="Write your announcement, update or civic message…"
          />
        </div>

        {/* Category + Department */}
        <div className="sfa-composer-grid">
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

        {/* Priority chips */}
        <div className="sfa-form-group" style={{ marginBottom: '0.85rem' }}>
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

        {/* Post Extras: Emoji + BG Color */}
        <div className="sfa-form-group" style={{ marginBottom: '1.75rem' }}>
          <label>Post Extras</label>
          <div className="sfa-extras-row">
            {/* Emoji */}
            <div className="sfa-extras-item">
              <button type="button" className="sfa-btn sfa-btn-ghost"
                onClick={() => setShowEmoji((p) => !p)}>
                😀 Insert Emoji
              </button>
            </div>

            {/* BG Color preview card */}
            <div className="sfa-extras-item sfa-bg-picker-wrap">
              <div
                className="sfa-bg-preview-card"
                onClick={() => document.getElementById('sc-bg-color-input').click()}
                title="Click to choose background color"
              >
                <div className="sfa-bg-strip" style={{ background: form.bgColor }} />
                <div className="sfa-bg-info">
                  <span className="sfa-bg-label">🎨 Background Color</span>
                  <span className="sfa-bg-hex">{form.bgColor}</span>
                </div>
                <div className="sfa-bg-presets">
                  {['#1E3150', '#5377A2', '#601A35', '#059669', '#D97706', '#E5D38A'].map((c) => (
                    <button key={c} type="button"
                      className={`sfa-bg-preset-dot${form.bgColor === c ? ' active' : ''}`}
                      style={{ background: c }} title={c}
                      onClick={(e) => { e.stopPropagation(); setForm((p) => ({ ...p, bgColor: c })); }}
                    />
                  ))}
                  <button type="button" className="sfa-bg-preset-custom" title="Custom color…"
                    onClick={(e) => { e.stopPropagation(); document.getElementById('sc-bg-color-input').click(); }}>+</button>
                </div>
              </div>
              <input id="sc-bg-color-input" type="color" value={form.bgColor}
                onChange={(e) => setForm((p) => ({ ...p, bgColor: e.target.value }))}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* Emoji picker */}
        {showEmoji && (
          <div style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
            <EmojiPicker onEmojiClick={(d) => setForm((p) => ({ ...p, text: p.text + d.emoji }))}
              autoFocusSearch={false} width={310} height={350} />
          </div>
        )}

        {/* Image drop zone */}
        <label htmlFor="sc-image-input"
          className={`sfa-drop-zone${isDragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleImageSelection(f); }}>
          📎 Drag &amp; drop image or click to upload
        </label>
        <input id="sc-image-input" type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => handleImageSelection(e.target.files?.[0])} />

        {form.imagePreview && (
          <img src={form.imagePreview} alt="Preview" className="sfa-image-preview" />
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
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
