import { resolveComponent } from "../components/componentRegistry.js";

/**
 * Puente entre el runtime A2UI (reducer.js) y el component registry que
 * ya existía (ver docs/03-arquitectura-tecnica/02-catalogo-componentes.md).
 * Toma una surface YA RESUELTA (resolveSurface / listSurfaces) y monta el
 * componente React correspondiente con sus datos.
 */
export default function A2uiSurfaceView({ surface, onConfirm }) {
  if (!surface) return null;
  const Component = resolveComponent(surface.component);
  return <Component data={surface.data} onConfirm={onConfirm} />;
}
