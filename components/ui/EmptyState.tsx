import { Card } from './Card';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 mb-4 text-gray-300 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 mb-6 max-w-xs">{description}</p>
      )}
      {action && <div>{action}</div>}
    </Card>
  );
}