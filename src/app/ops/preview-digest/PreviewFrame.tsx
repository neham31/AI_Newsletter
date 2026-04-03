'use client';

interface PreviewFrameProps {
  html: string;
}

export function PreviewFrame({ html }: PreviewFrameProps) {
  return (
    <iframe
      srcDoc={html}
      style={{
        width: '100%',
        height: '800px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        background: '#fff',
      }}
      title="Email Preview"
    />
  );
}
