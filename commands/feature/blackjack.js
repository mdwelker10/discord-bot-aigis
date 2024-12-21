/**
 * BLACKJACK COMMAND initial thoughts
 * - /blackjack start <time-limit> 
 *    - Time limit is optional, default is 30 seconds per action. Must be between 10 and 60 seconds
 * - /blackjack join
 * - /blackjack bet <amount>
 *    - Can be used to change your bet at any point
 *    - minimum is 10 (might change), maximum is 1,000,000 (might change)
 *    - ensure players cannot go over 9,007,199,254,740,991 
 * - Actions will be buttons attached to message
 * 
 * - If a player leaves, they will be removed from the game and their bet will be returned
 * - If a player does not respond, auto stand for 2 turns. 3rd turn they are removed from the game and their bet is returned
 * - TODO: Figure out a way to prevent abusing leave, which might allow a player to only play good deals
 *    - Maybe in database or whatever store time of leaving and dont allow them to join back for a certain amount of time
 * - If a player cannot cover their bet, it is reset to 10. If they cannot cover 10 they are kicked from the table
 * - When all players have left or been kicked, the game ends
 * 
 * CURRENCY:
 * - Velvet Tokens (VT)
 * - Yoink Velvet Room emblem/logo and put it on something to make it look like a chip
 * - Figure out starting amount and interest rate and stuff later, and maybe ways to earn more
 * - Maybe have a leaderboard for the top 10 players across all servers (opt in to have name displayed)
 *    - New command to claim daily tokens, see your balance, opt in to global leaderboard, see server leaderboard, maybe add bonuses for consecutive dailys
 * 
 * GAMEPLAY:
 * - Max of 7 players per table
 * - Each table assigned a unique ID, players can only interact with 1 table at a time across all servers
 * - Use 10 decks, reshuffle at 64 cards remaining
 * - Aigis will be the dealer - she will always hit on 16 or lower, stand on 17 or higher
 * 
 * - Player order is join time, dealer last
 * - Each player turn send:
 *    - Canvas (npm) image with Player name, Player cards, dealer card (maybe with back of 2nd card for aesthetic), player bet, player balance 
 *    - Buttons for hit, stand, double down, leave, and split if it's a valid move. Button handling in index.js
 *    - Text message stating the time limit
 * 
 * SCENARIOS:
 * - Blackjack (first turn) 
 *   - Send a public ping with player(s) that hit blackjack and their canva image. Maybe one image / player at a time
 *   - If dealer has blackjack, show that canva image and send it publically
 * - Hit = Draw card, send message that player X hit, send updated canvas to player
 * - Stand = Send message that player X stood, move on to next turn
 * - Double down = Double bet, draw 1 card, show canva image to player, move on to next turn
 * - Leave = Remove player from game, return bet, send message that player X left
 * - Split (player needs 2 cards of same denomination)
 *   - Only allow 1 split per turn
 *   - Essentially have 2 turns in 1, play first hand then second hand separately
 *      - TODO: Figure out specifics of how to handle this
 *   - Place bet on each hand
 *   - Announce that "player X split - playing their first hand", show canva image of hand 1 to player, then play that hand
 *   - When hand 1 is played, send public message "player X started second hand", show canva image of hand 2 to player, then play that hand
 *   - Remember to handle the bets for each hand separately
 * - Insurance (not implementing)
 * 
 * GAMBLING:
 * - Take away bet from player at turn start
 * - Bust = lose bet
 * - Win = 2x bet
 * - Blackjack = 2.5x bet
 * - Tie = bet returned
 * - Dealer bust = bet back + winnings
 * 
 */