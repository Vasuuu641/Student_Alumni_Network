export enum InterestSignalType {
  THREAD_VIEW = 'THREAD_VIEW',
  THREAD_OPEN = 'THREAD_OPEN',
  THREAD_REPLY = 'THREAD_REPLY',
  THREAD_LIKE = 'THREAD_LIKE',
  THREAD_SAVE = 'THREAD_SAVE',
  GEO_VIEW = 'GEO_VIEW',
  GEO_VISIT = 'GEO_VISIT',
  GEO_SAVE = 'GEO_SAVE',
  CATEGORY_BROWSE = 'CATEGORY_BROWSE',
  PANEL_FOCUS = 'PANEL_FOCUS',
}

export class UserInterestProfile {
  constructor(
    public readonly userId: string,
    public academicWeight: number,
    public alumniWeight: number,
    public careerWeight: number,
    public housingWeight: number,
    public shoppingWeight: number,
    public internshipWeight: number,
    public readonly lastUpdatedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  getWeightForPanel(panel: 'ACADEMIC' | 'ALUMNI'): number {
    return panel === 'ACADEMIC' ? this.academicWeight : this.alumniWeight;
  }

  getTopics(): Array<{ name: string; weight: number }> {
    return [
      { name: 'career', weight: this.careerWeight },
      { name: 'housing', weight: this.housingWeight },
      { name: 'shopping', weight: this.shoppingWeight },
      { name: 'internship', weight: this.internshipWeight },
    ].filter((t) => t.weight > 0);
  }
}

export class UserInterestSignal {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: InterestSignalType,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly sourcePanel: string | null,
    public readonly sourceModule: string,
    public readonly strength: number,
    public readonly metadataJson: Record<string, unknown> | null,
    public readonly createdAt: Date,
  ) {}
}

export class NotificationCandidate {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: string,
    public title: string,
    public body: string,
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly sourceModule: string,
    public rawScore: number,
    public aiScore: number | null,
    public finalScore: number,
    public isEligible: boolean,
    public scoringReason: string | null,
    public rejectionReason: string | null,
    public readonly actionUrl: string | null,
    public readonly dedupeKey: string | null,
    public readonly metadataJson: Record<string, unknown> | null,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
  ) {}
}
