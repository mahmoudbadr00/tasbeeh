import { RichTextEditorProps } from "@/interfaces/types";

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, disabled = false }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    rows={2}
    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed resize-none transition-all duration-200"
  />
);