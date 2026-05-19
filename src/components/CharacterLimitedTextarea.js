import React from 'react';

const CharacterLimitedTextarea = ({
  id,
  label,
  value,
  onChange,
  maxLength = 500,
  rows = 3,
  placeholder = '',
}) => {
  const currentLength = value?.length || 0;

  return (
    <div className="mb-3">
      {label && <label className="form-label small" htmlFor={id}>{label}</label>}
      <textarea
        id={id}
        className="form-control"
        rows={rows}
        maxLength={maxLength}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className={`form-text text-end ${currentLength >= maxLength ? 'text-danger' : ''}`}>
        {currentLength}/{maxLength}
      </div>
    </div>
  );
};

export default CharacterLimitedTextarea;
