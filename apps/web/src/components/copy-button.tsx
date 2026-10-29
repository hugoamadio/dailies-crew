'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { buttonClass } from './ui';

export function CopyButton(props: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass('ghost', 'sm')}
      onClick={async () => {
        await navigator.clipboard.writeText(props.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? props.copiedLabel : props.label}
    </button>
  );
}
