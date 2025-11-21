export type Member = 'Me' | 'Emad' | 'Mazen' | 'Salah';
export type Project = 'Dija admin' | 'Dija supplier' | 'Dija website' | 'Klarito';
export type Status = 'To test' | 'Has issue' | 'To do' | 'Done';

export interface Task {
  id: string;
  date: string;
  member: Member;
  project: Project;
  branch: string;
  task: string;
  status: Status;
  note: string;
  created_at: number;
  updated_at: number;
}

export type RowMode = 'view' | 'edit' | 'create';

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}

export interface InputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

export interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onClose: () => void;
}

export interface TaskRowProps {
  task?: Task;
  mode: RowMode;
  onSave: (data: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void;
  onDiscard: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  date: string;
}