export type FieldType = "text" | "date" | "money" | "percent" | "quantity";

export type FieldSpec = {
  id: string;
  label: string;
  type: FieldType;
  labelToken: string;
  documents: string[];
};

export type SchemaFile = {
  version: string;
  fields: FieldSpec[];
};

export type RulesFile = {
  version: string;
  vatToleranceRappen: number;
  holdIfAnyFieldEmpty: boolean;
  holdIfVatMismatch: boolean;
  holdIfCostCentreMissing: boolean;
  costCentre: { token: string; missingReason: string };
  types: Record<FieldType, string>;
};

export type TemplatesFile = {
  version: string;
  draftIntro: string;
  bookLine: string;
  holdLine: string;
  reasonConflict: string;
  reasonMissing: string;
  reasonVat: string;
  finalBook: string;
  finalHoldApproved: string;
  finalReject: string;
  claimNote: string;
};

export type Segment = { id: string; text: string };
export type Doc = { id: string; title: string; segments: Segment[] };
export type Dossier = {
  id: string;
  title: string;
  call: boolean;
  blurb: string;
  documents: Doc[];
};
export type DossiersFile = { version: string; dossiers: Dossier[] };
export type GoldFile = { version: string; readings: Record<string, Record<string, string[]>> };

export type FieldStatus = "filled" | "conflict" | "missing";

export type DerivedField = {
  id: string;
  label: string;
  status: FieldStatus;
  value: string | null;
  segmentIds: string[];
};

export type Derivation = {
  fields: DerivedField[];
  recommendation: "book" | "hold";
  reasons: string[];
  draftText: string;
  accepted: Record<string, string[]>;
  vatCleared: boolean;
  costCentreMissing: boolean;
};

export type ChainEvent = {
  sessionId: string;
  seq: number;
  type: string;
  createdAt: string;
  prevHash: string;
  payload: unknown;
  canonical: string;
  hash: string;
};
