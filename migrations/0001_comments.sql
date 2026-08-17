CREATE TABLE comments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	visitor_hash TEXT
);

CREATE INDEX comments_created_at ON comments(created_at DESC);
CREATE INDEX comments_visitor_hash ON comments(visitor_hash, created_at DESC);
