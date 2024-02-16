import test from "node:test";
import db from "../db";
const testGameIds = [
  'c3315d54-d943-490a-8c65-18fb57ab1a36',
  '478ac769-4e16-4151-8c2a-88a9283ed561'
]
const testPlayerIds = [
  '08b9a3b4-1fa0-4d1d-bfa2-e6955a1db3e2',
  '6fea23b5-d9c6-4c3d-92cc-8653965c4748'
]

/** This function removes any leftover test data and establishes
 * a clean DB slate, then re-creates common test data.
 */
async function commonBeforeAll() {
  // noinspection SqlWithoutWhere
  await db.query("DELETE FROM games");

  // noinspection SqlWithoutWhere
  await db.query("DELETE FROM players");

  // noinspection SqlWithoutWhere
  await db.query("DELETE FROM game_players");

  // noinspection SqlWithoutWhere
  await db.query("DELETE FROM game_turns");

  // create test players
  await db.query(`
    INSERT INTO players (id, ai, name, color)
    VALUES
      ($1, TRUE, 'AI Player 1', '#c3c3c3'),
      ($2, FALSE, 'Human Player 2', '#c2c2c2')
  `, [testPlayerIds[0], testPlayerIds[1]]);

  // create test game
  await db.query(`
    INSERT INTO games (id, width, height)
    VALUES
      ($1, 6, 7),
      ($2, 8, 9)
  `,[testGameIds[0], testGameIds[1]]);
}

/** These next two functions allow for wrapping all db actions
 * during a test inside a DB transaction */

async function commonBeforeEach() {
  await db.query("BEGIN");
}

async function commonAfterEach() {
  await db.query("ROLLBACK");
}

async function commonAfterAll() {
  await db.end();
}

export {
  commonBeforeAll,
  commonAfterAll,
  commonBeforeEach,
  commonAfterEach,
  testGameIds,
  testPlayerIds
};