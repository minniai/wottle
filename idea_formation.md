# Wottle MVP Game Ideation

This is a description of a MVP for the Wottle word game to be implemented as the first iteration of the game do a trial with actual users.

This will be a fully functioning version of the game but with Minimum Viable functionality. The implementation will however have to be a full game that stands on its own and can attract users.

The name Wottle a short for Word Battle.

## Game Description

- Wottle is a 2-player word game, played on a 16x16 board
- The 16x16 grid initially filled with random letters
- Players take turns on switching two letters with the goal of finding words
- The objective of the game is to as many words from a list of words provided by the game
- The words are considered valid if they are readable as one of the following:
  - horizontally from left-to-right in a single line
  - vertically from top-to-bottom in a single column
  - dioganally from top left to bottom right
- Valid words cannot wrap around the grid (e.g. from column 16 and continue in column 1)
- The word list can be with a specific theme and rules about what kind of words to find, e.g. from a a list of Icelandic nouns to a list of English verbs, or it can be a words with a specific theme, like all the words from the the script of _Game of Thrones_
- The word list can be extensive, e.g. the whole English Scrabble word list which is almost 300.000 words
- The scoring system is like in Scrabble, where each letter has a point value and valid word found are scored as a sum of the letter weights
- The players battle in real time under time pressure as they have fixed time to play the game where they are timed like in a chess game with a chess clock.

## Gameplay

### Game Start

- The game starts when the player has been paired with a player through the invitation and pairing mechanism
- The player is presented with the 16x16 grid showing 256 letter tiles, each one showing a random letter
- The grid has been filled with the letters of the alphabet randomly but with the following conditions:
  1. the randomness is according to the weighted distribution of the scoring, so the letters that score the lowest appear most often and the once that score the highest appear most often in the grid
  2. every letter must appear at least once somewhere in the grid, i.e. none of the valid letter is missing from the board.
- For clarification, the distribution is true weigthed randomness, which means that some letters may be shown only once while other can appear multiple times, and the starting board is thus different each tim.
- The player plays an opponent in real time with a visible timer counting down while it is their turn to play.
- They players tae turns maing a move where they switch two letters in the grid. At any time it is either the current player's turn or the opponent's turn like as in chess and it should be obvious to the player when it is their turn to make a move
- The game may be 10 minutes for each player and their times are shown on the screen counting down as they are playing, Each player has one clock which counts down while it is their turn to play.

### Make Move

- Score: Score is updated for each round with the value of all new words formed in that move with the following formula: Sum of all letter values of all letters in new words found in the entire gride in that round
- Players take turns swapping two letters on the 16x16 grid
- Time Limit: 30 seconds per turn
- Game Length: 10 moves per player
- Enter your username on the landing page
- Wait for other players to join the lobby
- Click on a player's name to send a game invitation
- Accept/decline invitations to start playing
- Take turns swapping letters to form words
- Game ends after 10 moves each - highest score wins!

## Initial Word List: Icelandic Nouns

- The initial MVP version uses a list of Icelandic nouns. Words must be in nominative case, singular, without articles.
  - The word list is available in the WORD_DICTIONARY set in the file [word_list_icelandic_noun.ts](./word_list_icelandic_nouns.ts) and contains just under to 18.000 Icelandic nouns.

Users and Game Management (Initial version MVP)

- You can register as a user and create a user name
- When you login you end upp in the game lobby, where you can see other users who have logged in
- To start a game and challenge other users in either of the following two ways:
  1. Direct Invitation: You can send direct invitations to another users in the game lobby to play a game.
  2. Immediate Rated Pairing:
     You can also start to play by pressing "Start a game" button, in which case you are immediately paired with the person with the closest Elo rating in the game lobby.
     - You will then be paired with either an other player who has selected "Start a game". Or if there is noone who has pressed "Start a game", i.e. a waiting player, then an invitation is sent to player who is wait

## Architecture

**Server-Side** (`ssserver.coffee`):

- Express HTTP server for static files
- Socket.IO WebSocket server for real-time communication
- Game session management and player matchmaking
- Turn-based timer system (60 seconds per turn)

**Game Logic**:

- `GameManager`: Handles multiple games and player management
- `Game`: Individual game state and turn management
- `Player`: Player data, scoring, and move validation
- `Dictionary`: Icelandic word validation and marking
- `Grid`: 8×8 letter grid with swap functionality

### Communication Flow

```text
Client ←→ Socket.IO ←→ Server
  ↓                       ↓
Login → Lobby → Invite → Game → Moves → Results → End
```