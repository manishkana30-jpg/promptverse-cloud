export class AppError extends Error {
  public code: string;
  public remedy?: string;
  public action_link?: string;
  public statusCode: number;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    remedy?: string,
    action_link?: string
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.remedy = remedy;
    this.action_link = action_link;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        remedy: this.remedy,
        action_link: this.action_link
      }
    };
  }
}
