// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string; // user id
  username: string;
  iat?: number;
  exp?: number;
}
