# Original PostgreSQL reference

Exported from the original `backend-db-1` PostgreSQL 16.3 container through Portainer on 16 October 2026, using `pg_dump` with read-only transactions.

- `stockmarket-full-2026-10-16.sql`: full schema, all nine tables of data, sequence values, indexes, primary/foreign keys and ownership. Contains account records and password hashes. Local-only, ignored by Git, and stored with owner-only file permissions. Never copy it into `public/`.
- `stockmarket-schema-2026-10-16.sql`: the same schema with COPY data blocks and sequence-current-value statements removed. Safe structural reference for the old application.

Full backup: 36,155 bytes. SHA-256: `c13c7c4b0a93420fe26bff080bb552fcf9c516368abc11f48409a5b406269103`.

Tables: `users`, `games`, `players`, `stocks`, `game_stocks`, `player_stocks`, `insights`, `player_insights`, `feed_items`.

The original database was stopped again after export. The backup is for reference; none of its user accounts or saved games were imported into Convex.

To restore into a **new empty PostgreSQL database** using an account able to create objects owned by postgres:

```sh
psql -X --set ON_ERROR_STOP=on --dbname YOUR_EMPTY_DATABASE --file stockmarket-full-2026-10-16.sql
```

Do not run that against an existing database.
