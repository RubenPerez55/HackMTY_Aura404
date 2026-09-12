// Fallback obligatorio (ver docs/01-agentic-ui-frontend/03-arquitectura-
// componentes-reutilizables.md): nunca debe faltar, para que un uiHint
// no reconocido no rompa la demo en vivo.
export default function GenericJsonView({ data }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
        Componente genérico (uiHint no reconocido)
      </p>
      <pre className="bg-gray-50 rounded-xl p-3 text-xs overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
