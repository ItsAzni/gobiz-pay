export class GoBizError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoBizError";
  }
}

export class AuthError extends GoBizError {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class HttpError extends GoBizError {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export class ConfigError extends GoBizError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class QrisError extends GoBizError {
  constructor(message: string) {
    super(message);
    this.name = "QrisError";
  }
}
