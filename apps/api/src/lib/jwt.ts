import jwt from 'jsonwebtoken';

const JWT_ALGORITHM = 'HS256' as const;

export type AccessTokenClaims = {
  id: string;
  email: string;
  role: string;
  tv: number;
  iat?: number;
  exp?: number;
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não está definida nas variáveis de ambiente');
  }
  return secret;
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '12h';
}

export function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 43200;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return num;
    case 'm':
      return num * 60;
    case 'h':
      return num * 3600;
    case 'd':
      return num * 86400;
    default:
      return 43200;
  }
}

export function signAccessToken(user: {
  id: string;
  email: string;
  role: string;
  tokenVersion?: number;
}) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion ?? 0,
    },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: parseExpiresIn(getJwtExpiresIn()),
    },
  );
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
  }) as AccessTokenClaims;
}
