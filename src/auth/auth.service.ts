import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const username = dto.username?.trim();
    const password = dto.password;

    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }

    if (username.length < 3) {
      throw new BadRequestException('Username must be at least 3 characters');
    }

    if (password.length < 4) {
      throw new BadRequestException('Password must be at least 4 characters');
    }

    const existing = await this.userRepository.findOne({
      where: { username },
    });

    if (existing) {
      throw new ConflictException('Username is already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      displayName: dto.displayName?.trim() || username,
    });

    const savedUser = await this.userRepository.save(user);

    const payload = {
      sub: savedUser.id,
      username: savedUser.username,
      role: savedUser.role || 'user',
    };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: savedUser.id,
        username: savedUser.username,
        displayName: savedUser.displayName,
        role: savedUser.role || 'user',
      },
    };
  }

  async login(dto: LoginDto) {
    const username = dto.username?.trim();
    const password = dto.password;

    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }

    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role || 'user',
    };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role || 'user',
      },
    };
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role || 'user',
    };
  }
}
