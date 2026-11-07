import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { createBlankDesign } from '@/services/designActions';
import { designRepository } from '@/services/designRepository';
import { useEditorStore } from '@/state/editorStore';
import { applyLayoutPreset, setTheme } from '@/state/layoutOps';

/**
 * Creates a blank design in memory and opens it in the editor.
 * Optional `?theme=<id>` and `?layout=<preset id>` start it with that theme
 * and that layout (filled with sample visuals). Unknown values are ignored.
 */
export function EditorNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const created = useRef(false);

  useEffect(() => {
    if (created.current) return; // StrictMode runs effects twice in development.
    created.current = true;
    let doc = createBlankDesign();
    const theme = params.get('theme');
    if (theme) {
      const r = setTheme(doc, theme);
      if (r.ok) doc = r.value;
    }
    const layout = params.get('layout');
    let filled = false;
    if (layout) {
      const r = applyLayoutPreset(doc, doc.pages[0]!.id, layout, 'rearrange');
      if (r.ok) {
        doc = r.value.doc;
        filled = true;
      }
    }
    const open = (persisted: boolean) => {
      useEditorStore.getState().load(doc, { persisted });
      navigate(`/editor/${doc.id}`, { replace: true });
    };
    // A design that starts with content is saved right away (like a template copy);
    // an empty one is saved on its first edit.
    if (filled) {
      designRepository.save(doc).then(
        () => open(true),
        () => open(false),
      );
    } else open(false);
  }, [navigate, params]);

  return null;
}
