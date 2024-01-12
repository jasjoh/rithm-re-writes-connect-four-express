\echo 'Delete and recreate connect-four db?'
\prompt 'Return for yes or control-C to cancel > ' foo

DROP DATABASE IF EXISTS connect_four;
CREATE DATABASE connect_four;
\connect connect_four;


CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  ai BOOLEAN DEFAULT FALSE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  width NUMERIC(2) DEFAULT 7 NOT NULL,
  height NUMERIC(2) DEFAULT 6 NOT NULL
);

INSERT INTO players
VALUES (1, TRUE, 'AI Player 1', '#c3c3c3'),
       (2, FALSE, 'Human Player 2', '#c2c2c2');

INSERT INTO games
VALUES (1, 5, 5),
       (2, 6, 8);
