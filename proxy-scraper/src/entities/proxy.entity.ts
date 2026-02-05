import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ProxyProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS4 = 'socks4',
  SOCKS5 = 'socks5',
}

export enum ProxyAnonymity {
  TRANSPARENT = 'transparent',
  ANONYMOUS = 'anonymous',
  ELITE = 'elite',
}

@Entity('proxies')
export class Proxy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  ip: string;

  @Column()
  port: number;

  @Column({
    type: 'enum',
    enum: ProxyProtocol,
    default: ProxyProtocol.HTTP,
  })
  protocol: ProxyProtocol;

  @Column({ nullable: true })
  country_code?: string;

  @Column({ default: false })
  in_chinese_mainland: boolean;

  @Column({
    type: 'enum',
    enum: ProxyAnonymity,
    default: ProxyAnonymity.TRANSPARENT,
  })
  anonymity: ProxyAnonymity;

  @Column({ nullable: true, type: 'int' })
  delay?: number | null;

  @Column({ default: 60 })
  test_timeout: number;

  @Column({ nullable: true })
  test_url?: string;

  @Column({ type: 'json', nullable: true })
  test_headers?: Record<string, string>;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: 0 })
  usage_count: number;

  @Column({ default: 0 })
  success_count: number;

  @Column({ default: 0 })
  failure_count: number;

  @Column({ nullable: true })
  last_used_at?: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'json', nullable: true })
  extra?: Record<string, any>;
}