import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Expense {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  date: Date;

  @Column()
  item: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column()
  category: string;
}
