import { ExpressError, NotFoundError, BadRequestError } from "../expressError";
import {
  TooFewPlayers, PlayerAlreadyExists,
  InvalidGameState, InvalidPiecePlacement, NotCurrentPlayer
} from "../utilities/gameErrors";
import { SQLQueries } from "../utilities/sqlQueries";
import { CountResultInterface } from "../utilities/commonInterfaces";

import db from "../db";
import { PlayerInterface } from "./player";
import { QueryResult } from "pg";
import { InitializeHook } from "module";
import { stringify } from "querystring";

/** Game model
 * Supports CRUD operations + Game Turn Logic
 * Games are composed of:
 * - id: GUID
 * - height and width: numbers
 * - gameState: numbers {0: not started, 1: started, 2: won, 3: tied}
 * - placedPieces: array of coordinates, e.g. [[0, 1], [0, 2]]
 * - winningSet: array of coordinates, e.g. [[0, 1], [0, 2]]
 * - currPlayerId: the id (GUID) of the current player
 * - totalPlayers: the total number of players added to the game
 * - createdOn: the datetime for when the game was created
 * - board: a matrix of board cell states: { playerId, validCoordSets }
 * --- validCoordSets: array of coordinates, e.g. [[0, 1], [0, 2]]
 * --- note that board cell states are null until the game is started
 *
 */

/**
 * TODO:
 * - update select statement to return as camelCase + update interfaces
 */

// an initialized board cell has this interface
interface BoardCellFinalStateInterface {
  playerId: string | null;
  validCoordSets: number[][][];
}

// a board cell can be null if uninitialized or in a final state if initialized
type BoardCellStateType = BoardCellFinalStateInterface | null;

// an initialized board full of finalized board cells
type InitializedBoardType = BoardCellFinalStateInterface[][];

interface NewGameInterface {
  height: number;
  width: number;
}

interface GameInterface {
  id: string;
  width: number;
  height: number;
  gameState: number;
  placedPieces: number[][] | null;
  board: InitializedBoardType | null;
  winningSet: number[][] | null;
  currPlayerId: string | null;
  createdOn: Date;
  totalPlayers: number;
}

interface InitializedGameInterface extends GameInterface {
  board: InitializedBoardType;
  currPlayerIid: string;
}

interface CheckGameEndInterface {
  board: InitializedBoardType;
  placedPieces: number[][];
}

interface GamePlayersInterface {
  playerId: string;
  gameId: string;
  playOrder: number | null;
  ai: undefined | boolean;
}

interface EndGameState {
  state: number,
  winningSet: number[][] | null,
  winningPlayerId: string | null
}

class Game {

  /**
   * Instantiates a new game based on params and returns it.
   *
   * Params are optional, but should be { height, width }
   *
   * Returns { ... game object ... }
   * */
  static async create(
    newGame: NewGameInterface = { height: 7, width: 6 }
  ) : Promise<GameInterface> {

    /** TODO:
     * - input validation
     * - error handling
     */

    const result: QueryResult<GameInterface> = await db.query(`
                INSERT INTO games (
                                    height,
                                    width
                                  )
                VALUES  (
                          $1,
                          $2
                        )
                RETURNING
                    id,
                    height,
                    width,
                    game_state AS "gameState",
                    created_on AS "createdOn"`, [
      newGame.height,
      newGame.width
    ],
    );

    const game = result.rows[0];

    return game;
  }

  /**
   * Retrieves an array of all games with summary information
   * Returns [{ id, gameState, createdOn }, ...]   *
   * */
  static async getAll() : Promise<GameInterface[]> {

    const result: QueryResult<GameInterface> = await db.query(`
        SELECT
          id,
          game_state AS "gameState",
          created_on AS "createdOn",
          COUNT(game_players.game_id) AS "totalPlayers"
        FROM games
        LEFT JOIN game_players on games.id = game_players.game_id
        GROUP BY games.id, games.game_state, games.created_on
        ORDER BY created_on`
    );

    return result.rows;
  }

  /**
   * Given a game id, return data about game.
   *
   * Returns { ... game object ... }
   *
   * Throws NotFoundError if not found.
   **/
  static async get(gameId: string) : Promise<GameInterface> {
    const result: QueryResult<GameInterface> = await db.query(`
        SELECT
          id,
          height,
          width,
          board,
          game_state AS "gameState",
          placed_pieces AS "placedPieces",
          winning_set AS "winningSet",
          curr_player_id AS "currPlayerId",
          created_on AS "createdOn",
          COUNT(game_players.game_id)::int as "totalPlayers"
        FROM games
        LEFT OUTER JOIN game_players ON games.id = game_players.game_id
        WHERE id = $1
        GROUP BY games.id, games.height, games.width, games.board,
                  games.game_state, games.placed_pieces, games.winning_set,
                  games.curr_player_id, games.created_on
    `, [gameId]);

    const game = result.rows[0];
    console.log("game found:", game);

    if (!game) throw new NotFoundError(`No game with id: ${gameId}`);

    return game;
  }

  /**
   * Delete given game from database; returns undefined.   *
   * Throws NotFoundError if game not found.
   **/
  static async delete(gameId: string) {
    const result: QueryResult<GameInterface> = await db.query(`
        DELETE
        FROM games
        WHERE id = $1
        RETURNING id`, [gameId]);
    const game = result.rows[0];

    if (!game) throw new NotFoundError(`No game: ${gameId}`);
  }

  /** Adds a player to an existing game
   * Throws error if game or player doesn't exist or player already added
   * Returns current player count if successful
   */
  static async addPlayers(players: string[], gameId: string) {

    let sqlQueryValues: string = '';

    for (let i = 0; i < players.length; i++) {
      i === players.length - 1 ? sqlQueryValues += `($1, $${i+2})` : sqlQueryValues += `($1, $${i+2}),`
    }

    try {
      await db.query(
        `
        INSERT INTO game_players (game_id, player_id)
        VALUES ${sqlQueryValues}
        RETURNING
          player_id as "playerId",
          game_id as "gameId",
          play_order as "playOrder"
        `
        , [gameId, ...players]
      );
    } catch (err: unknown) {
      const postgresError = err as { code?: string, message: string; };
      if (postgresError.code === '23505') {
        throw new PlayerAlreadyExists(
          `One or more players have already been added to game ${gameId}`
        );
      } else { throw err; }
    }

    const result: QueryResult<CountResultInterface> = await db.query(`
        SELECT COUNT(*)
        FROM game_players
        WHERE game_id = $1
    `, [gameId]);
    console.log("result of getting count from game_players:", result);

    return result.rows[0].count;
  }

  /**
   * Removes a player from a game; returns undefined.   *
   * Throws NotFoundError if game or player not found.
   **/
  static async removePlayer(playerId: string, gameId: string) {
    const result: QueryResult<GamePlayersInterface> = await db.query(`
        DELETE
        FROM game_players
        WHERE player_id = $1 AND game_id = $2
        RETURNING player_id as "playerId"`, [playerId, gameId]);
    const removedPlayer = result.rows[0];

    if (!removedPlayer) throw new NotFoundError(`No such player or game.`);
  }

  /** Adds a player to an existing game
   * Throws error if game or player doesn't exist or player already added
   * Returns current player count if successful
   */
  static async getPlayers(gameId: string) {
    // console.log("Game.getPlayers() called with gameId:", gameId)
    const sqlQuery = `
      SELECT ${SQLQueries.defaultPlayerCols}, game_players.play_order as "playOrder"
      FROM players
      INNER JOIN game_players
      ON game_players.player_id = players.id
      WHERE game_players.game_id = $1
      ORDER BY players.created_on
    `;
    const result: QueryResult<PlayerInterface> = await db.query(sqlQuery, [gameId]);
    // console.log("result rows of selecting game players:", result.rows);
    return result.rows;
  }

  /** Starts a game.
   * Initializes / resets game state and then calls startTurn
   * Throws error is there are insufficient players to start a game or game
   * doesn't exist
   * Returns undefined
  */
  static async start(gameId: string) {

    // verify game exists
    const queryGIResult: QueryResult<GameInterface> = await db.query(`
        SELECT
          height,
          width
        FROM games
        WHERE id = $1`, [gameId]);
    const game = queryGIResult.rows[0];
    if (!game) throw new NotFoundError(`No game with id: ${gameId}`);

    // verify 2 players minimum
    const queryCountResult: QueryResult<CountResultInterface> = await db.query(`
        SELECT COUNT(*)
        FROM game_players
        WHERE game_id = $1`, [gameId]
    );
    if (queryCountResult.rows[0].count < 2) {
      throw new TooFewPlayers(`Game (${gameId}) has too few players to be started.`);
    }

    // initialize the board and reset game state
    const board = this.createInitializedBoard({height: game.height, width: game.width});
    await db.query(`
        UPDATE games
        SET
          board = $2,
          game_state = DEFAULT,
          placed_pieces = DEFAULT,
          winning_set = DEFAULT,
          curr_player_id = DEFAULT
        WHERE id = $1`, [gameId, board]
    );

    // start the next turn
    Game.startTurn(gameId);
    return undefined;


    /** Initialized a new board upon creation of a new game
     * Fills in all cells with BoardCellFinalStates { player, validCoords }
     * Returns a newly created board (array of array of BoardCellFinalStates)
     */
    function _initializeNewBoard(height: number, width: number) {

      const newBoardState: BoardCellStateType[][] = [];

      _initializeMatrix();
      _populateBoardSpaces();

      return newBoardState;

      /** Initializes the valid boundaries of the board */
      function _initializeMatrix() {
        // console.log("_initializeMatrix() called.");
        for (let y = 0; y < height; y++) {
          const row = [];
          for (let x = 0; x < width; x++) {
            row.push(null);
          }
          newBoardState.push(row);
        }
        // console.log("Matrix initialized.")
      }

      function _populateBoardSpaces() {
        // console.log("_populateBoardSpaces() called.")
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            // console.log("attempting to set game board for xy:", y, x);
            newBoardState[y][x] = {
              playerId: null,
              validCoordSets: _populateValidCoordSets(y, x)
            };
          }
        }

        // console.log("Board spaces populated:", newBoardState);

        /** Accepts board coordinates and return array of valid coord sets */
        function _populateValidCoordSets(y: number, x: number) {
          // console.log("_populateValidCoordSets called with yx:", y, x);
          const vcs: number[][][] = [];
          let coordSet: number[][] = [];

          /**
           * check each direction to see if a valid set of coords exist.
           * since we can't lookup column values for rows which are undefined,
           * we will check if the row exists before checking anything else
          */

          // does a row existing 4 rows above?
          if (newBoardState[y - 3] !== undefined) {
            // check up and diagonals

            // check up
            if (newBoardState[y - 3][x] !== undefined) {
              coordSet = [];
              coordSet.push([y, x]);
              coordSet.push([y - 1, x]);
              coordSet.push([y - 2, x]);
              coordSet.push([y - 3, x]);
              vcs.push(coordSet);
            }

            // check upLeft
            if (newBoardState[y - 3][x - 3] !== undefined) {
              coordSet = [];
              coordSet.push([y, x]);
              coordSet.push([y - 1, x - 1]);
              coordSet.push([y - 2, x - 2]);
              coordSet.push([y - 3, x - 3]);
              vcs.push(coordSet);
            }

            // check upRight
            if (newBoardState[y - 3][x + 3] !== undefined) {
              coordSet = [];
              coordSet.push([y, x]);
              coordSet.push([y - 1, x + 1]);
              coordSet.push([y - 2, x + 2]);
              coordSet.push([y - 3, x + 3]);
              vcs.push(coordSet);
            }
          }

          // check left and right

          // check left
          if (newBoardState[y][x - 3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y, x - 1]);
            coordSet.push([y, x - 2]);
            coordSet.push([y, x - 3]);
            vcs.push(coordSet);
          }

          // check right
          if (newBoardState[y][x + 3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y, x + 1]);
            coordSet.push([y, x + 2]);
            coordSet.push([y, x + 3]);
            vcs.push(coordSet);
          }

          // console.log("Valid coord sets populated:", vcs)
          return vcs;
        }
      }

    }
  }

  /**
   * Initializes a new turn for a given game; accepts the id of that game
   * Updates current player and if it's an AI, calls that player's aiTakeTurn()
   * Returns undefined
   */
  static async startTurn(gameId: string) {
    console.log("Game.startTurn called w/ gameId:", gameId);
    /**
     * Core Logic:
     * - determines current player
     * -- if current player is AI, calls that player's aiTakeTurn() callback
     * -- if current player is human, awaits that player's pieceDrop
     */
    let queryGIResult: QueryResult<GameInterface> = await db.query(`
      SELECT id, width, curr_player_id as "currPlayerId"
      FROM games
      WHERE id = $1
    `, [gameId]
    );

    console.log("initialQueryGIResult:", queryGIResult);

    let currPlayerId = queryGIResult.rows[0].currPlayerId;
    console.log("currPlayerId established:", currPlayerId);

    let nextPlayer: GamePlayersInterface;
    let newGame: boolean = false;

    /**
     *
     * Logic for establishing play order in a new game
     *
    */

    /** Check if there isn't a current player and if so, establish turn
     * order and then pick a first player and set them as current player  */
    if (currPlayerId === null) {
      // new game
      newGame = true;

      // there is not, so set turn order for all players
      console.log("No current player found.");
      console.log("Establishing player order and selecting / setting curr player.");

      // get an array of all player IDs
      const queryGPIResult: QueryResult<GamePlayersInterface> = await db.query(`
          SELECT player_id as "playerId"
          FROM game_players
          WHERE game_id = $1
      `, [gameId]
      );

      let playerIds: string[] = [];
      for (let row of queryGPIResult.rows) {
        playerIds.push(row.playerId);
      }
      console.log("All playerIds after querying game_players:", playerIds);

      // randomly sort the array () - Fisher Yates
      for (let i = playerIds.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * i);
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
      }
      console.log("playerIds after randomly sorting:", playerIds);

      console.log("setting play order in game_players.");
      // build SQL statement from array
      let sqlQuery = 'UPDATE game_players SET play_order = CASE ';
      for (let i = 0; i < playerIds.length; i++) {
        sqlQuery += `WHEN player_id = '${playerIds[i]}' THEN ${i} `;
      }
      sqlQuery += `END WHERE game_id = $1`;
      // console.log("completed sqlQuery for setting play order:", sqlQuery);

      // execute SQL statement to set play order
      await db.query(sqlQuery, [gameId]);
      console.log("play order set in game_players");

      // set curr_player to game_players player with play_order = 0
      currPlayerId = playerIds[0];
      console.log("curr player ID set to:", currPlayerId);

      const queryGIResult = await db.query(`
          UPDATE games
          SET curr_player_id = $2
          WHERE id = $1
          RETURNING games.id, games.curr_player_id as "currPlayerId"
      `, [gameId, playerIds[0]]);

      console.log("game updated w/ curr player set:", queryGIResult.rows[0]);
      return;
    }

    /** There is already a current player so we need to figure out who
     * the next player is and then set curr_player to that */

    // get game players
    const queryGPIResult: QueryResult<GamePlayersInterface> = await db.query(`
        SELECT
          game_players.player_id as "playerId",
          game_players.play_order as "playOrder",
          players.ai
        FROM game_players
        INNER JOIN players ON game_players.player_id = players.id
        WHERE game_players.game_id = $1
    `, [gameId]);

    const gamePlayersWithAiData = queryGPIResult.rows;
    console.log("game players with AI state before selecting next:", gamePlayersWithAiData);

    console.log("attempting to find player with currPlayerId:", currPlayerId);
    const currGamePlayerObject = gamePlayersWithAiData.find(
      o => o.playerId === currPlayerId
    );

    if (currGamePlayerObject === undefined) {
      throw new Error("Unable to find current player.");
    }

    // if this is a new game or current player is last player, next player is the turn 0 player
    if (newGame || currGamePlayerObject.playOrder === gamePlayersWithAiData.length - 1) {

      const turnZeroPlayer = gamePlayersWithAiData.find(o => o.playOrder === 0);
      if (turnZeroPlayer === undefined) {
        throw new Error("Unable to find turn zero player.");
      }

      // next player will be turn 0 player
      nextPlayer = turnZeroPlayer;

    } else {

      // we are not a new game or the last player, so just go to next player in order
      const currPlayerPlayOrder = currGamePlayerObject.playOrder;

      if (currPlayerPlayOrder === null) {
        throw new Error("Player play order improperly initialized.");
      }

      const potentialNextPlayer = gamePlayersWithAiData.find(
        o => o.playOrder === currPlayerPlayOrder + 1
      );

      if (potentialNextPlayer === undefined) {
        throw new Error("Unable to find next player.");
      }

      // next player is simply the next player in play order
      nextPlayer = potentialNextPlayer;

    }

    console.log("nextPlayer found:", nextPlayer);

    queryGIResult = await db.query(`
        UPDATE games
        SET curr_player_id = $2
        WHERE id = $1
        RETURNING games.id, games.curr_player_id as "currPlayerId"
    `, [gameId, nextPlayer.playerId]);

    console.log("game updated w/ curr player set:", queryGIResult.rows[0]);

    // TODO: Added call to aiCallback() function

  }

  /**
   * Attempts to drop a piece on behalf of a player at a given column
   * Accepts a game ID, player ID and column to drop in
   * If successful, adds turn record and checks for game end
   * If game is not over, starts next turn (to switch to next player)
   * Returns true if the drop was successful, otherwise false   *
   */
  static async dropPiece(gameId: string, playerId: string, col: number) {
    /**
     * Core Logic:
     * - determine validity of drop
     * - place piece if valid (update board state)
     * - add game turn record
     * - check for end game:
     * -- if end game, update state accordingly and you're done
     * -- if game is not ended, call startTurn for provide gameId
     */
    console.log(`dropPiece() called with
      gameId: ${gameId}, playerId: ${playerId}, col: ${col}`
    );

    const queryGIResult: QueryResult<GameInterface> = await db.query(`
      SELECT
        board,
        game_state as "gameState",
        curr_player_id as "currPlayerId",
        width,
        height,
        placed_pieces as "placedPieces"
      FROM games
      WHERE id = $1
    `, [gameId]);

    const gameResult = queryGIResult.rows[0];

    if (gameResult.board === null) {

    }

    const initGame = _validateGameState();

    if (col < 0 || col > initGame.width - 1) {
      throw new InvalidPiecePlacement('Specified column is out of bounds.');
    }

    const targetRow: number | null = _findEmptyCellInColumn();
    console.log(`targetRow ${targetRow} found.`);

    if (targetRow === null) {
      throw new InvalidPiecePlacement('Column is full.');
    }

    const pieceLocation = [targetRow, col]

    await _addToBoard();

    await _addTurnRecord();

    const sqlQueryGIResult : QueryResult<CheckGameEndInterface> = await db.query(`
        SELECT board, placed_pieces as "placedPieces"
        FROM games
        WHERE id = $1
      `, [gameId]);

    const gameState = sqlQueryGIResult.rows[0];

    const endGameState = this.checkForGameEnd(gameState);

    console.log("checkForGameEnd() called and endGameState set:", endGameState);

    await _updateGameState();

    if (endGameState.state === 1) {
      console.log("Game has not ended so calling startTurn()");
      // start the next turn
      await Game.startTurn(gameId);
    }

    /** Validates games is in state where a piece can be dropped by the current player. */
    function _validateGameState(): InitializedGameInterface {
      if (gameResult === null) throw new NotFoundError(`No game with id: ${gameId}`);
      if (gameResult.board === null) {
        throw new InvalidGameState('Game board not initialized.');
      }
      if (gameResult.gameState !== 1) {
        throw new InvalidGameState('Game is not started or has finished.');
      }
      if (gameResult.currPlayerId !== playerId) {
        throw new NotCurrentPlayer(`${playerId} is not the current player.`);
      }
      return gameResult as InitializedGameInterface;
    }

    /* Finds an empty row in a given column to place a piece. */
    function _findEmptyCellInColumn(): number | null {
      console.log(`_findEmptyCellInColumn(${col}) called.`);
      // check if the column is full and return 'null' if true
      if (initGame.board[0][col].playerId !== null) {
        console.log("this col was full");
        return null;
      }

      let row = 0; // start at first row

      // loop through rows top to bottom until we either:
      // -- find a non-null cell (and return the slot above)
      // -- reach the last cell and return it
      while (row < initGame.height) {
        if (initGame.board[row][col].playerId !== null) {
          // console.log("found a piece at row, col", row, " ", col);
          // console.log("returning the row above:", row - 1);
          console.log(`returning ${row} - 1.`);
          return row - 1;
        }
        row++;
      }
      console.log(`returning initGame.height (${initGame.height}) - 1:`, initGame.height - 1);
      return initGame.height - 1;
    }

    /** Adds a piece to a location in the board */
    async function _addToBoard(): Promise<number[]> {
      console.log(`_addToBoard(${pieceLocation[0]}, ${pieceLocation[1]}) called.`);
      initGame.board[pieceLocation[0]][pieceLocation[1]].playerId = playerId;
      if (initGame.placedPieces === null) {
        initGame.placedPieces = [[pieceLocation[0], pieceLocation[1]]];
      } else {
        initGame.placedPieces.push([pieceLocation[0], pieceLocation[1]]);
      }

      // console.log('updated board after addition:', initGame.board);

      await db.query(`
        UPDATE games
        SET
          board = $2,
          placed_pieces = $3
        WHERE id = $1
      `, [gameId, initGame.board, initGame.placedPieces]
      );

      return [pieceLocation[0], pieceLocation[1]];
    }

    /** Add turn record to a game */
    async function _addTurnRecord() {
      await db.query(`
        INSERT INTO game_turns ( game_id, player_id, location )
        VALUES ( $1, $2, $3 )
      `, [gameId, playerId, pieceLocation]);
    }

    /** Checks for game end */
    async function _updateGameState() {
      if (endGameState.state === 2) {
        if (endGameState.winningPlayerId !== playerId) {
          throw new Error("Game is won, but not by current player. Something went wrong.")
        }
        console.log("updating game state in DB since winner was found");
        const winningSet = endGameState.winningSet;
        await db.query(`
          UPDATE games
          SET
            winning_set = $2
            gameState = 2
          WHERE id = $1
        `, [gameId, winningSet]);
        return;
      }

      // check for tie
      if(endGameState.state === 3) {
        console.log("updating game state in DB since tie was found");
        await db.query(`
          UPDATE games
          SET
            gameState = 3
          WHERE id = $1
        `, [gameId]);
        return;
      }
    }
  }

  /** Checks to see if a game has ended and if there is a winner, what
   * the winning pieces are and who the winning player is.
   * Accepts a game state (CheckEndGameInterface)
   * Returns an end game state (EndGameState)
   */
  static checkForGameEnd(gameState: CheckGameEndInterface): EndGameState {

    console.log("checkForGameEnd() called with gameState:", gameState);

    let endGameState : EndGameState = {
      state: 1,
      winningSet: null,
      winningPlayerId: null
    }

    for (let i = 0; i < gameState.placedPieces.length; i++) {
      const py = gameState.placedPieces[i][0];
      const px = gameState.placedPieces[i][1];
      // console.log("checking placed piece at xy", py, px);
      // check each valid coord set for gameState piece
      for (let j = 0; j < gameState.board[py][px].validCoordSets.length; j++) {
        const validCoordSets = gameState.board[py][px].validCoordSets[j];
        const playerId = gameState.board[validCoordSets[j][0]][validCoordSets[j][1]].playerId;
        if ( playerId !== null &&
          validCoordSets.every(
            c => {
              return (
                gameState.board[c[0]][c[1]].playerId !== null &&
                gameState.board[c[0]][c[1]].playerId === playerId)
            }
          )
        ) {
          console.log("checkForGameEnd() determined game is won")
          endGameState.state = 2;
          endGameState.winningSet = gameState.board[py][px].validCoordSets[j];
          endGameState.winningPlayerId = playerId;
          return endGameState;
        }
      }
    }

    // check for tie
    if(gameState.board[0].every(cell => cell.playerId !== null)) {
      console.log("checkForGameEnd() determined game is tied")
      endGameState.state = 3;
      return endGameState;
    }

    console.log("checkForGameEnd() determined game should continue")
    return endGameState;
  }

  /** Creates an initialized game board (full of cells in a final state)
   * Accepts dimensions for the board as a NewGameInterface
   * Returns the newly initialized boards as an InitializedBoardType
   */
  static createInitializedBoard(boardDimensions : NewGameInterface) : InitializedBoardType {

    const newBoardState: BoardCellStateType[][] = [];

    _initializeMatrix();
    _populateBoardSpaces();

    return newBoardState as InitializedBoardType;

    /** Initializes the valid boundaries of the board */
    function _initializeMatrix() {
      // console.log("_initializeMatrix() called.");
      for (let y = 0; y < boardDimensions.height; y++) {
        const row = [];
        for (let x = 0; x < boardDimensions.width; x++) {
          row.push(null);
        }
        newBoardState.push(row);
      }
      // console.log("Matrix initialized.")
    }

    function _populateBoardSpaces() {
      // console.log("_populateBoardSpaces() called.")
      for (let y = 0; y < boardDimensions.height; y++) {
        for (let x = 0; x < boardDimensions.width; x++) {
          // console.log("attempting to set game board for xy:", y, x);
          newBoardState[y][x] = {
            playerId: null,
            validCoordSets: _populateValidCoordSets(y, x)
          };
        }
      }

      // console.log("Board spaces populated:", newBoardState);

      /** Accepts board coordinates and return array of valid coord sets */
      function _populateValidCoordSets(y: number, x: number) {
        // console.log("_populateValidCoordSets called with yx:", y, x);
        const vcs: number[][][] = [];
        let coordSet: number[][] = [];

        /**
         * check each direction to see if a valid set of coords exist.
         * since we can't lookup column values for rows which are undefined,
         * we will check if the row exists before checking anything else
        */

        // does a row existing 4 rows above?
        if (newBoardState[y - 3] !== undefined) {
          // check up and diagonals

          // check up
          if (newBoardState[y - 3][x] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y - 1, x]);
            coordSet.push([y - 2, x]);
            coordSet.push([y - 3, x]);
            vcs.push(coordSet);
          }

          // check upLeft
          if (newBoardState[y - 3][x - 3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y - 1, x - 1]);
            coordSet.push([y - 2, x - 2]);
            coordSet.push([y - 3, x - 3]);
            vcs.push(coordSet);
          }

          // check upRight
          if (newBoardState[y - 3][x + 3] !== undefined) {
            coordSet = [];
            coordSet.push([y, x]);
            coordSet.push([y - 1, x + 1]);
            coordSet.push([y - 2, x + 2]);
            coordSet.push([y - 3, x + 3]);
            vcs.push(coordSet);
          }
        }

        // check left and right

        // check left
        if (newBoardState[y][x - 3] !== undefined) {
          coordSet = [];
          coordSet.push([y, x]);
          coordSet.push([y, x - 1]);
          coordSet.push([y, x - 2]);
          coordSet.push([y, x - 3]);
          vcs.push(coordSet);
        }

        // check right
        if (newBoardState[y][x + 3] !== undefined) {
          coordSet = [];
          coordSet.push([y, x]);
          coordSet.push([y, x + 1]);
          coordSet.push([y, x + 2]);
          coordSet.push([y, x + 3]);
          vcs.push(coordSet);
        }

        // console.log("Valid coord sets populated:", vcs)
        return vcs;
      }
    }
  }
}

export {
  Game,
  GameInterface,
  NewGameInterface,
  BoardCellFinalStateInterface,
  InitializedBoardType
};
