import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class AiSummaryCache {
  @PrimaryGeneratedColumn()
  id: number;

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
