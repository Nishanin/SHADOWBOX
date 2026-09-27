export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface EvidenceStreamItem {
  id: string;
  dimension: 'Environment' | 'Code' | 'CI';
  icon: string;
  source: string;
  finding: string;
  weight: string;
  keyDetails: string[];
}

export interface CodeSnippetLine {
  lineNumber: number;
  content: string;
  highlight?: 'highlight' | 'warning' | 'normal';
}

export interface MechanismStep {
  stepNumber: number;
  label: string;
  localState: string;
  ciState: string;
  note: string;
}

export interface RootCauseData {
  pageTitle: string;
  pageSubtitle: string;
  status: string;
  failureTarget: string;
  confidenceRating: ConfidenceLevel;
  confidenceNote: string;
  primaryDiagnosis: {
    title: string;
    description: string;
    impactSummary: string;
    category: string;
    affectedComponent: string;
  };
  codeInspection: {
    filename: string;
    description: string;
    lines: CodeSnippetLine[];
    highlightedTokens: string[];
  };
  evidenceStreams: EvidenceStreamItem[];
  mechanismTrace: {
    timestamp: string;
    steps: MechanismStep[];
  };
  recommendation: {
    title: string;
    description: string;
    targetEnvironment: string;
    containerImage: string;
  };
  ctaText: string;
  ctaPath: string;
  backPath: string;
}
