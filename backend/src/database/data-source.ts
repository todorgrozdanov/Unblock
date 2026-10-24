import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './database.config.js';

export default new DataSource(createDatabaseOptions());
