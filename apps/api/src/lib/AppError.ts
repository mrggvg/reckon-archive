export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = 'Potrebna je prijava') {
    super(401, msg);
  }
}

export class NotFoundError extends AppError {
  constructor(msg = 'Ni najdeno') {
    super(404, msg);
  }
}

export class ConflictError extends AppError {
  constructor(msg: string) {
    super(409, msg);
  }
}

export class ValidationError extends AppError {
  constructor(fields: Record<string, string>) {
    super(422, 'Preverite vnesene podatke', fields);
  }
}
