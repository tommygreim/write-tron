import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { forwardRef, useImperativeHandle, useEffect } from 'react';

export interface StoryEditorHandle {
  getHTML: () => string;
  getText: () => string;
  appendHTML: (html: string) => void;
  setContent: (html: string) => void;
  focus: () => void;
}

interface Props {
  initialContent?: string;
  readOnly?: boolean;
}

const StoryEditor = forwardRef<StoryEditorHandle, Props>(
  ({ initialContent = '', readOnly = false }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: 'Begin your story here, then press Generate to have the AI continue it…',
        }),
        Typography,
      ],
      content: initialContent || '<p></p>',
      editable: !readOnly,
      editorProps: {
        attributes: {
          class:
            'min-h-full w-full outline-none text-slate-200 font-serif text-lg leading-8 prose prose-invert max-w-none',
          spellcheck: 'true',
        },
      },
    });

    useEffect(() => {
      if (editor && readOnly !== !editor.isEditable) {
        editor.setEditable(!readOnly);
      }
    }, [editor, readOnly]);

    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() ?? '',
      getText: () => editor?.getText() ?? '',
      appendHTML: (html: string) => {
        if (!editor) return;
        editor.commands.focus('end');
        editor.commands.insertContent(html);
      },
      setContent: (html: string) => {
        if (!editor) return;
        editor.commands.setContent(html || '<p></p>');
      },
      focus: () => editor?.commands.focus(),
    }));

    return (
      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }
);

StoryEditor.displayName = 'StoryEditor';
export default StoryEditor;
