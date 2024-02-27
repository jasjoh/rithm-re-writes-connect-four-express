import db from "../db";

import {
  Game,
  GameInterface,
  BoardCellFinalStateInterface,
  InitializedBoardType
 } from "./game";

/**
 * Factory function for creating a new Game and setting it's state
 * Accepts an initial state as a matrix representing desired game state
 * Returns the newly created Game instance
 */
function createGameWithState(initialState: InitializedBoardType): GameInterface {
  const boardDimensions = {
    height: initialState.length,
    width: initialState[0].length
  }

  // populate placedPieces based on initialState
  const placedPieces : number[][] = [];

  for (let y = 0; y < initialState.length; y++) {
    for (let x = 0; x < initialState[y].length; y++) {
      if (initialState[y][x].playerId !== null) {
        placedPieces.push([y, x]);
      }
    }
  }

  // determine game state
  const gameState = Game.checkForGameEnd({board: initialState, placedPieces: placedPieces});



}