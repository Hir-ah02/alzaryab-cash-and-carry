import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import TextField from './TextField';

export default function PasswordField(props) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className="field__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          aria-controls={props.id}
          disabled={props.disabled}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      }
    />
  );
}
