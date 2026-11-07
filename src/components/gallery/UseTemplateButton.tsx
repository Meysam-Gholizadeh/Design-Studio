import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { toast } from '@/components/common/toastStore';
import { createDesignFromTemplate } from '@/services/designActions';
import { useEditorStore } from '@/state/editorStore';

/** Creates an independent, saved copy of the template and opens it in the editor. */
export function UseTemplateButton({ templateId }: { templateId: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const doc = await createDesignFromTemplate(templateId);
      useEditorStore.getState().load(doc, { persisted: true });
      toast.success('Your copy is ready to edit. The original template is unchanged.');
      navigate(`/editor/${doc.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t create your copy.');
      setBusy(false);
    }
  };

  return (
    <Button
      variant="primary"
      size="lg"
      onClick={onClick}
      disabled={busy}
      iconRight={busy ? <Loader2 size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
    >
      Use this design
    </Button>
  );
}
