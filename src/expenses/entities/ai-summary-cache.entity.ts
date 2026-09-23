import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('ai_summary_cache')
@Unique(['year', 'month', 'userId'])
export class AiSummaryCache {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: true })
  userId: number;

  @Column()
  year: number;

  @Column()
  month: number; // 1-indexed

  @Column('text')
  summary: string;

  @Column({ default: true })
  generated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
