import './PlaceholderPage.css';

interface PlaceholderPageProps {
  step: number;
  title: string;
  description: string;
}

/**
 * PlaceholderPage — shared skeleton used by every route until
 * real page content is implemented.
 */
export function PlaceholderPage({ step, title, description }: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page__badge">Step {step}</div>
      <h1 className="placeholder-page__title">{title}</h1>
      <p className="placeholder-page__description">{description}</p>
      <div className="placeholder-page__notice">
        This page is a placeholder. Content will be implemented in a future phase.
      </div>
    </div>
  );
}
