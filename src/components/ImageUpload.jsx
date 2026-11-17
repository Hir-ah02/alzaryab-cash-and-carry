import { useRef, useState } from 'react';
import { CircleAlert, ImageUp, RefreshCw, Trash2, Upload } from 'lucide-react';
import cx from '../utils/cx';
import { formatFileSize } from '../utils/format';
import { ACCEPTED_IMAGE_TYPES, loadPreview, releasePreview, validateImageFile } from '../utils/image';
import Button from './Button';
import IconButton from './IconButton';

/**
 * Drag-and-drop image picker.
 * value:    { src, name, size?, file? } | null  (file is set for a newly chosen image)
 * onChange: called with the new value or null
 * error:    validation message from the form (e.g. required)
 *
 * States: empty, drag-over, processing, error, uploaded (preview).
 */
export default function ImageUpload({ id, value, onChange, error }) {
  const inputRef = useRef(null);
  const dropRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');
  const [processing, setProcessing] = useState(false);

  const shownError = fileError || error;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const openPicker = () => inputRef.current?.click();

  const handleFiles = async (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError('');
    setProcessing(true);
    try {
      const src = await loadPreview(file);
      releasePreview(value?.src);
      onChange({ src, name: file.name, size: file.size, file });
    } catch (err) {
      setFileError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const dragHandlers = {
    onDragEnter: (e) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!dragOver) setDragOver(true);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
  };

  const removeImage = () => {
    releasePreview(value?.src);
    onChange(null);
    setFileError('');
    // Move focus to the drop zone that replaces the preview.
    requestAnimationFrame(() => dropRef.current?.focus());
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_IMAGE_TYPES.join(',')}
      hidden
      tabIndex={-1}
      onChange={(e) => {
        handleFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );

  const errorMessage = shownError && (
    <p id={errorId} className="field__error" style={{ marginTop: 8 }}>
      <CircleAlert size={14} aria-hidden="true" />
      {shownError}
    </p>
  );

  if (value) {
    return (
      <div className="upload-preview" {...dragHandlers}>
        <div className={cx('upload-preview__image', dragOver && 'is-dragover')}>
          <img src={value.src} alt={`Preview of ${value.name || 'product image'}`} />
        </div>
        <div className="upload-preview__meta">
          <span className="upload-preview__file-icon" aria-hidden="true">
            <ImageUp size={18} />
          </span>
          <div className="upload-preview__info">
            <p className="upload-preview__name" title={value.name}>
              {value.name || 'Product image'}
            </p>
            <p className="upload-preview__size">{value.size ? formatFileSize(value.size) : 'Current image'}</p>
          </div>
          <IconButton icon={Trash2} variant="delete" label="Remove image" onClick={removeImage} disabled={processing} />
        </div>
        <div className="upload-preview__actions">
          <Button
            id={id}
            variant="secondary"
            leadingIcon={RefreshCw}
            onClick={openPicker}
            loading={processing}
            loadingText="Processing…"
            aria-describedby={shownError ? errorId : undefined}
          >
            Change Image
          </Button>
        </div>
        {errorMessage}
        {fileInput}
      </div>
    );
  }

  return (
    <div>
      <button
        ref={dropRef}
        id={id}
        type="button"
        className={cx('upload', dragOver && 'is-dragover', shownError && 'is-invalid')}
        onClick={openPicker}
        disabled={processing}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={cx(hintId, shownError && errorId)}
        {...dragHandlers}
      >
        <span className="upload__icon" aria-hidden="true">
          {processing ? <span className="spinner" /> : <Upload size={22} />}
        </span>
        <span className="upload__title">{processing ? 'Processing image…' : 'Upload Product Image'}</span>
        <span className="upload__text">
          {dragOver ? (
            'Drop the image to upload'
          ) : (
            <>
              Drag and drop an image here or <span className="upload__browse">browse</span>
            </>
          )}
        </span>
        <span id={hintId} className="upload__formats">
          Supported formats: JPG, PNG, WEBP · Max 5 MB
        </span>
      </button>
      {errorMessage}
      {fileInput}
    </div>
  );
}
