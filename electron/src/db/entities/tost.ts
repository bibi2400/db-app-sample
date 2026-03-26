import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Tost {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    tost!: number;

}