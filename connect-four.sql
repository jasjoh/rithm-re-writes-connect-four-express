\echo 'Delete and recreate connect-four db?'
\prompt 'Return for yes or control-C to cancel > ' foo

DROP DATABASE IF EXISTS connect_four;
CREATE DATABASE connect_four;
\connect connect_four;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ai BOOLEAN DEFAULT FALSE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_on TIMESTAMPTZ DEFAULT current_timestamp
);

-- As an alternative to matrices, we could create these dynamically as tables
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  width INTEGER DEFAULT 7 NOT NULL,
  height INTEGER DEFAULT 6 NOT NULL,
  game_state INTEGER DEFAULT 1 NOT NULL,
  placed_pieces INTEGER[][],
  board JSONB[][] NOT NULL,
  winning_set INTEGER[][],
  curr_player_id UUID
    REFERENCES players,
  created_on TIMESTAMPTZ DEFAULT current_timestamp
);

CREATE TABLE game_players (
  player_id UUID
    REFERENCES players ON DELETE CASCADE,
  game_id UUID
    REFERENCES games ON DELETE CASCADE,
  PRIMARY KEY (player_id, game_id)
);

-- We don't want to delete the turn when a player is deleted (it still happened)
CREATE TABLE game_turns (
  id SERIAL PRIMARY KEY,
  player_id UUID
    REFERENCES players ON DELETE SET NULL,
  game_id UUID
    REFERENCES games ON DELETE CASCADE,
  created_on_epoch BIGINT DEFAULT extract(epoch from current_timestamp)
);

INSERT INTO players (ai, name, color)
VALUES (TRUE, 'AI Player 1', '#c3c3c3'),
       (FALSE, 'Human Player 2', '#c2c2c2');
