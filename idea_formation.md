# Wottle Game Ideation

## Game Description

- Wottle (WOrd baTTLE) is a 2-player word game, played on a 16x16 board
- The 16x16 grid initially filled with random letters
- Players take turns on switching two letters with the goal of finding words
- The objective of the game is to as many words from a list of words provided by the game
- The word list can be with a specific theme and rules about what kind of words to find, e.g. from a a list of Icelandic nouns to a list of English verbs, or it can be a words with a specific theme, like all the words from the the script of _Game of Thrones_
- The word list can be extensive, e.g. the whole English Scrabble word list which is almost 300.000 words
- Scoring System: Each letter has a point value, like in Scrabble, multiplied by word count

## Playing the Game

- Enter your username on the landing page
- Wait for other players to join the lobby
- Click on a player's name to send a game invitation
- Accept/decline invitations to start playing
- Take turns swapping letters to form words
- Game ends after 10 moves each - highest score wins!

## Game Mechanics

- Grid: 16x16 board with weighted letter distribution
- Real-time: Instant move updates and live opponent interaction
- Score: Score is updated for each round with the value of all new words formed in that move with the following formula: Sum of all letter values of all letters in new words found in the entire gride in that round
- Gameplay: Take turns swapping two letters on the 16x16 grid
- Time Limit: 30 seconds per turn
- Game Length: 10 moves per player

## Initial Word List: Icelandic Nouns
- The initial first version uses a list of Icelandic nouns. Words must be in nominative case, singular, without articles.
  - The word list is available in the WORD_DICTIONARY set in the file [word_list_icelandic_noun.ts](./word_list_icelandic_nouns.ts) and contains just under to 18.000 Icelandic nouns.



# Architecture

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

```
Client ←→ Socket.IO ←→ Server
  ↓                    ↓
Login → Lobby → Invite → Game → Moves → Results → End
```
