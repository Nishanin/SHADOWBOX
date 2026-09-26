export type AgentType = 'environment' | 'code' | 'ci';

export type InvestigationStatus = 'COMPLETE' | 'INVESTIGATING' | 'PENDING';

export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Finding {
  title: string;
  description: string;
  impact: ImpactLevel;
}

export interface EvidenceItem {
  type: string;
  source: string;
  description: string;
  technicalValues?: string[];
}

export interface MissingEvidenceItem {
  description: string;
  whyItMatters: string;
}

export interface InvestigationTrack {
  id: AgentType;
  label: string;
  agent: string;
  status: InvestigationStatus;
  focus: string;
  runAt: string;
  findings: Finding[];
  evidence: EvidenceItem[];
  missingEvidence: MissingEvidenceItem[];
}

export interface ContributingSignal {
  dimension: string;
  summary: string;
}

export interface InvestigationSynthesisData {
  title: string;
  tag: string;
  description: string;
  contributingSignals: ContributingSignal[];
}

export interface InvestigationPageData {
  pageTitle: string;
  pageSubtitle: string;
  overallStatus: string;
  failureTarget: string;
  tracks: InvestigationTrack[];
  synthesis: InvestigationSynthesisData;
  ctaText: string;
  ctaPath: string;
}
