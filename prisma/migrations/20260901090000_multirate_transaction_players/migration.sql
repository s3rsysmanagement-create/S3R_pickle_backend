-- Drop the old unique constraint that only allowed one rate per player per transaction.
-- The new constraint allows the same player to appear multiple times
-- in the same transaction as long as each row has a different rateId.

DROP INDEX IF EXISTS "transaction_players_transaction_id_player_id_key";

CREATE UNIQUE INDEX "transaction_players_transaction_id_player_id_rate_id_key"
  ON "transaction_players"("transaction_id", "player_id", "rate_id");
