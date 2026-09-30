import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'aift_super_secret_jwt_key_2026',
      ),
    });
  }

  async validate(payload: {
    sub: number;
    username: string;
    role?: string;
  }): Promise<User> {
    if (!payload || !payload.sub || !payload.username) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      id: payload.sub,
      username: payload.username,
      displayName: payload.username,
      role: payload.role || 'user',
    } as User;
  }
}
