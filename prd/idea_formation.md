# Wottle MVP Game Ideation

This is a description of a MVP for the Wottle word game to be implemented as the first iteration of the game do a trial with actual users.

This will be a fully functioning version of the game but with Minimum Viable functionality. The implementation will however have to be a full game that stands on its own and can attract users.

The name Wottle a short for Word Battle.

## Game Description

- Wottle is a 2-player word game, played on a 16x16 board
- The 16x16 grid initially filled with random letters
- The two players have usernames and player colors, we call them white and black, although the actual colors can be something pleasing
- The player with white starts the game by making a move, like in chess
- Players take turns on switching two letters with the goal of finding words
- The objective of the game is to as many words from a list of words provided by the game
- The words are considered valid if they are readable in any direction in the grid, meaning all of the following:
  - horizontally from left-to-right
  - horizontally from right-to-left
  - vertically from top-to-bottom
  - vertically from bottom-to-top
  - diagonal from top-left to bottom-right
  - diagonal from bottom-right to top-left
  - diagonal from bottom-left to top-right
  - diagonal from bottom-right to top-left 
- Valid words cannot wrap around the grid (e.g. from column 16 and continue in column 1)
- The word list can be with a specific theme and rules about what kind of words to find, e.g. from a a list of Icelandic nouns to a list of English verbs, or it can be a words with a specific theme, like all the words from the the script of _Game of Thrones_
- The word list can be extensive, e.g. the whole English Scrabble word list which is almost 300.000 words
- The scoring system is like in Scrabble, where each letter has a point value and valid word found are scored as a sum of the letter weights
- The players battle in real time under time pressure as they have fixed time to play the game where they are timed like in a chess game with a chess clock.

### Game Start

- The game starts when the players have been paired through the invitation and pairing system
- The players are presented with the 16x16 grid showing 256 light-grey letter tiles, each one showing a random letter
- The timer is set 5 minutes for each player and their times are shown on the screen
- The grid has been filled with the letters of the alphabet randomly but with the following conditions:
  1. the randomness is according to the weighted distribution of the scoring, so the letters that score the lowest appear most often and the once that score the highest appear most often in the grid
  2. every letter must appear at least once somewhere in the grid, i.e. none of the valid letter is missing from the board
- The distribution is true weigthed randomness, which means that some letters may be shown only once while other can appear multiple times, and the starting board is thus different each time
- The players play against eachothher in real time with a visible timer counting down while it is their turn to play
- Both players can make the first move as soon the game starts and the timers of both players are counting down in the beginning
- As soon as a move is made by either player, their timer stops and they are considered to have made the first move
- The clock keeps counting down for the player who did not make the first move until they have made their move 
- They players then take turns making a move for 10 rounds, i.e. each player gets to make 10 moves in tota in total
- The timer counts down when it is their turn to make a move
- On each completed move, two seconds are added to the remaining time, i.e. the moment the user makes a swich
- If a player runs out of time before completing their 10 moves, the opponent can use their remainging time to complete the 10 moves, i.e. if white player runs out of time after 8 moves, black can make the remaining 2 moves with the time they have left.

### Moves

- For each move the player selects two letter tiles in the grid that are swapped
- Each player has one clock which counts down while it is their turn to play
- To indicate it is their turn the timer is green when it is activly counting down and neutral color otherwise, i.e. when it is stopped
- The player's timer counts down as soon as it is their turn to make a move and stops when they click/tap on the first tile
- The two seconds are added to their remaining time as soon as they complete the move by clicking/tapping on the second tile
- Moves can also be done by dragging the first tile onto the second tile and dropping it
- When a move is completed, by either clicking, tapping or dragging the tiles are swictched with a fast animation showing the swap of the tiles
- Any words in the grid that get are discovered by the letter swap are highlighted with the player's color
- The score of each move is calculated as follows:
  1. Add the sum of the letter-values of all leters in that have been found in the whole grid by the letter swap
  2. Word length bonus: Add +(word length – 2) per new word, i.e. +1 for 3‑letter, +5 for 7‑letter, etc.
  3. Multi‑word bonus: +2 for 2 words, +5 for 3+ words, +7 for 4+ words etc. for words formed in the same swap  
- The tiles of the words that were found by the tile swap are colored with the player's color, i.e. the tiles in the grid are colored
- The coloring of the claimed tiles must be done in a subtle way so as not to degrade readability of undiscovered words
- At any time it is either the current player's turn or the opponent's turn like as in chess and it should be obvious to the player when it is their turn to make a move
- Once a tile is marked as part of a discovered word, it is frozen or immovable, i.e. it cannot be selected for a swap for the rest of the gamefor a swap for the rest of the game
- Discovered words are marked in the player's color so all frozen letters are marked in the players color, and shared letters in overlapping words are marked in both player's colors
- It is important that the tile coloring is subtle so as not to interfere with the readability of words in the grid

### Scoring

- Score is updated for each round with the value of all new words formed in that move with the following formula: Sum of all letter values of all letters in new words found in the entire gride in that round
- The scoring of Icelandic letters can be found in the file [word_list_icelandic_scoring.ts](./word_list_icelandic_scoring.ts)
- Players take turns swapping two letters on the 16x16 grid
- Enter your username on the landing page
- Wait for other players to join the lobby
- Click on a player's name to send a game invitation
- Accept/decline invitations to start playing
- Take turns swapping letters to form words
- Game ends after 10 moves each or if either player is flagged
- Highest score wins!

### Game Completion

- The Game ends when:
  - either player runs out of time and their opponent completes their 10th move, or runs out of time also, i.e. their timer goes to zero and the opponent ha
  - the player with black plays the last move of 10 moves, if neither player ran out of time

### Initial Word List: Icelandic Nouns

- The initial MVP version uses a list of Icelandic nouns. Words must be in nominative case, singular, without articles.
  - The word list is available in the WORD_DICTIONARY set in the file [word_list_icelandic_noun.ts](./word_list_icelandic_nouns.ts) and contains just under to 18.000 Icelandic nouns.

## Users and Game Management (Initial version MVP)

- You can register as a user and create a user name
- When you login you end upp in the game lobby, where you can see other users who have logged in
- To start a game and challenge other users in either of the following two ways:
  1. Direct Invitation: You can send direct invitations to another users in the game lobby to play a game.
  2. Immediate Rated Pairing:
     You can also start to play by pressing "Start a game" button, in which case you are immediately paired with the person with the closest Elo rating in the game lobby.
     - You will then be paired with either an other player who has selected "Start a game". Or if there is noone who has pressed "Start a game", i.e. a waiting player, then an invitation is sent to player who is wait

## Architecture and technology

Front-end:
* TypeScript
* Next.JS
* Tailwind CSS

Back-end:
* Superbase Functions
* Superbase DB