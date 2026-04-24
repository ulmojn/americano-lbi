// Database connection and schema setup for MySQL
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'padel_tournament',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database tables
async function initDatabase() {
  const connection = await pool.getConnection();
  
  try {
    // Participants table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS participants (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        points INT DEFAULT 0,
        rating INT DEFAULT 1000,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Migration: tilføj rating hvis den mangler
    try {
      await connection.execute(`ALTER TABLE participants ADD COLUMN rating INT DEFAULT 1000`);
      console.log('✓ Migreret: rating kolonne tilføjet');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    console.log('✓ Participants table ready');

    // Tournaments table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tournament_type ENUM('americano', 'mexicano', 'winners_court', 'team_americano') NOT NULL,
        courts INT NOT NULL,
        players JSON NOT NULL,
        points_per_game INT DEFAULT 16,
        teams JSON DEFAULT NULL,
        status ENUM('active', 'completed') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Migration: tilføj points_per_game hvis den mangler (eksisterende databaser)
    try {
      await connection.execute(`ALTER TABLE tournaments ADD COLUMN points_per_game INT DEFAULT 16`);
      console.log('✓ Migreret: points_per_game kolonne tilføjet');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    // Migration: tilføj teams kolonne
    try {
      await connection.execute(`ALTER TABLE tournaments ADD COLUMN teams JSON DEFAULT NULL`);
      console.log('✓ Migreret: teams kolonne tilføjet');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    // Migration: udvid tournament_type ENUM med team_americano
    try {
      await connection.execute(`ALTER TABLE tournaments MODIFY COLUMN tournament_type ENUM('americano', 'mexicano', 'winners_court', 'team_americano') NOT NULL`);
      console.log('✓ Migreret: team_americano tilføjet til ENUM');
    } catch (e) {
      // Ignorér hvis allerede migreret
    }
    console.log('✓ Tournaments table ready');

    // Matches table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(36) PRIMARY KEY,
        tournament_id VARCHAR(36) NOT NULL,
        round INT NOT NULL,
        court INT NOT NULL,
        team1 JSON NOT NULL,
        team2 JSON NOT NULL,
        team1_score INT DEFAULT NULL,
        team2_score INT DEFAULT NULL,
        completed BOOLEAN DEFAULT FALSE,
        elo_delta INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
      )
    `);
    try {
      await connection.execute(`ALTER TABLE matches ADD COLUMN elo_delta INT DEFAULT NULL`);
      console.log('✓ Migreret: elo_delta kolonne tilføjet');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
    console.log('✓ Matches table ready');

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { pool, initDatabase };
