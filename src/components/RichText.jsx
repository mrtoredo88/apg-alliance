import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const PLUGINS = [remarkGfm, remarkBreaks];

export function RichText({ children, color, fontSize = 14, lineHeight = '22px' }) {
  if (!children) return null;
  const base = { color: color ?? 'inherit', fontSize, lineHeight, margin: 0 };
  return (
    <ReactMarkdown
      remarkPlugins={PLUGINS}
      components={{
        p:      ({ children }) => <p      style={{ ...base, marginBottom: 6 }}>{children}</p>,
        strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'inherit' }}>{children}</strong>,
        em:     ({ children }) => <em     style={{ fontStyle: 'italic', color: 'inherit' }}>{children}</em>,
        ul:     ({ children }) => <ul     style={{ paddingLeft: 18, margin: '0 0 6px', listStyleType: 'disc' }}>{children}</ul>,
        ol:     ({ children }) => <ol     style={{ paddingLeft: 18, margin: '0 0 6px' }}>{children}</ol>,
        li:     ({ children }) => <li     style={{ marginBottom: 2, lineHeight: '20px', color: color ?? 'inherit' }}>{children}</li>,
        a:      ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
            style={{ color: '#4A90D9', textDecoration: 'underline' }}>{children}</a>
        ),
      }}
    >
      {String(children)}
    </ReactMarkdown>
  );
}
