import { LifeEventTableView } from '../lifePlan/LifeEventTableView';

interface HeaderTabPlaceholderProps {
  title: string;
  description?: string;
}

export function HeaderTabPlaceholder({
  title,
  description = 'この機能は準備中です。',
}: HeaderTabPlaceholderProps) {
  if (title === 'ライフプラン' || title === 'ライフイベント表') {
    return <LifeEventTableView />;
  }

  return (
    <div className="header-tab-placeholder">
      <h2 className="header-tab-placeholder-title">{title}</h2>
      <p className="header-tab-placeholder-text">{description}</p>
    </div>
  );
}
