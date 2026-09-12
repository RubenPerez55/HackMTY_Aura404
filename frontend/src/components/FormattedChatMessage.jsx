import React from "react";

/**
 * Renderiza mensajes de texto del chat interpretando formateo tipo Markdown
 * ligero (negritas **texto**, cursivas *texto*, viñetas * o -, saltos de línea)
 * en elementos React puros y seguros (sin dangerouslySetInnerHTML).
 */
export default function FormattedChatMessage({ text, isUser = false }) {
  if (!text) return null;

  const lines = String(text).split("\n");

  const parseInline = (str) => {
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={match.index} className={isUser ? "font-bold text-white" : "font-bold text-gray-900"}>
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(
          <em key={match.index} className="italic">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={match.index}
            className={`px-1 py-0.5 rounded text-[10px] font-mono ${
              isUser ? "bg-gray-800 text-gray-200" : "bg-gray-200 text-gray-800"
            }`}
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }

    return parts.length > 0 ? parts : str;
  };

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Viñetas: "* " o "- "
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-1">
              <span className={`text-[10px] leading-relaxed select-none ${isUser ? "text-gray-300" : "text-[#EB0029]"}`}>
                •
              </span>
              <span className="flex-1">{parseInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}
