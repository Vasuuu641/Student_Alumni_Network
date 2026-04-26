export class GeoHelpBoardError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' = 'VALIDATION',
  ) {
    super(message);
    this.name = 'GeoHelpBoardError';
  }
}

export class GeoHelpBoardValidationError extends GeoHelpBoardError {
  constructor(message: string) {
    super(message, 'VALIDATION');
    this.name = 'GeoHelpBoardValidationError';
  }
}

export class GeoHelpBoardNotFoundError extends GeoHelpBoardError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'GeoHelpBoardNotFoundError';
  }
}

export class GeoHelpBoardConflictError extends GeoHelpBoardError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'GeoHelpBoardConflictError';
  }
}

export class GeoHelpBoardForbiddenError extends GeoHelpBoardError {
  constructor(message: string) {
    super(message, 'FORBIDDEN');
    this.name = 'GeoHelpBoardForbiddenError';
  }
}
