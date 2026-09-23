import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('incomes')
export class Income {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: true })
  userId: number;

  @ManyToOne(() => User, (user) => user.incomes, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  date: Date;

  @Column()
  source: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;
}
