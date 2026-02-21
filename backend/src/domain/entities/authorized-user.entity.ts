export class AuthorizedUser {
  constructor(
    public id: string,
    public email: string,
    public createdAt: Date,
    public updatedAt: Date,
    public isUsed: boolean
  ) {}
}