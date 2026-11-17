import { CloudOff, RefreshCw } from 'lucide-react';
import Button from './Button';
import EmptyState from './EmptyState';

export default function ErrorState({
  title = "Couldn't load products",
  text = 'Something went wrong while loading your data. Check your connection and try again.',
  onRetry,
  compact,
}) {
  return (
    <EmptyState
      icon={CloudOff}
      tone="error"
      title={title}
      text={text}
      compact={compact}
      role="alert"
      action={
        onRetry && (
          <Button variant="secondary" leadingIcon={RefreshCw} onClick={onRetry}>
            Try Again
          </Button>
        )
      }
    />
  );
}
