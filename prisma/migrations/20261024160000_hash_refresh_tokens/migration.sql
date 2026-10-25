BEGIN;
UPDATE "RefreshToken"
SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');

ALTER TABLE "RefreshToken" RENAME COLUMN "token" TO "tokenHash";
ALTER INDEX "RefreshToken_token_key" RENAME TO "RefreshToken_tokenHash_key";
COMMIT;